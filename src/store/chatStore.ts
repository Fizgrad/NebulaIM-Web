import { create } from "zustand";
import type { Conversation } from "../types/conversation";
import type { Group } from "../types/group";
import type { Message, MessageStatus } from "../types/message";
import type { User } from "../types/user";
import type { GatewayStatus } from "../services/gatewayClient";
import { useAuthStore } from "./authStore";
import { createId } from "../utils/id";
import { getGatewayClient } from "../services/gatewayClient";
import { useSettingsStore } from "./settingsStore";
import { useContactStore } from "./contactStore";
import { clientLogger } from "../services/clientLogger";
import {
  listBridgeConversations,
  markBridgeConversationRead,
  sendBridgeGroupMessage,
  sendBridgeSingleMessage
} from "../api/bridgeApi";

type MessagesByConversationId = Record<string, Message[]>;

type ChatState = {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversationId: MessagesByConversationId;
  gatewayStatus: GatewayStatus;
  setActiveConversationId: (conversationId: string | null) => void;
  loadConversations: () => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  retryMessage: (conversationId: string, messageId: string) => Promise<void>;
  receiveMessage: (message: Message) => void;
  markConversationRead: (conversationId: string) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: MessageStatus) => void;
  openConversationForUser: (user: User) => string;
  openConversationForGroup: (group: Group) => string;
  setGatewayStatus: (status: GatewayStatus) => void;
  startGatewaySession: () => Promise<void>;
  stopGatewaySession: () => void;
  clearLocalChat: () => void;
};

function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

function isNumericId(value?: string): value is string {
  return Boolean(value && /^\d+$/.test(value));
}

function directConversationId(userId: string) {
  return `direct-${userId}`;
}

function conversationIdForIncoming(message: Message) {
  if (message.groupId) return `group-${message.groupId}`;
  return directConversationId(message.fromUserId);
}

type BackendConversationInfo = Awaited<ReturnType<typeof listBridgeConversations>>[number];

function isLocalOnlyConversation(conversation: Conversation) {
  return !conversation.backendConversationId;
}

function isFallbackDirectTitle(conversation: Conversation) {
  return conversation.type === "single" && Boolean(conversation.targetUserId) && conversation.title === `User ${conversation.targetUserId}`;
}

function selectConversationTitle(localConversation: Conversation, backendConversation: Conversation) {
  if (!isFallbackDirectTitle(backendConversation)) return backendConversation.title;
  return localConversation.title || backendConversation.title;
}

function mergeBackendConversations(localConversations: Conversation[], backendConversations: Conversation[]) {
  const localById = new Map(localConversations.map((conversation) => [conversation.id, conversation]));
  const merged = backendConversations.map((backendConversation) => {
    const localConversation = localById.get(backendConversation.id);
    if (!localConversation) return backendConversation;
    return {
      ...backendConversation,
      title: selectConversationTitle(localConversation, backendConversation),
      avatar: backendConversation.avatar ?? localConversation.avatar,
      online: backendConversation.online ?? localConversation.online,
      targetUserId: backendConversation.targetUserId ?? localConversation.targetUserId,
      groupId: backendConversation.groupId ?? localConversation.groupId
    };
  });
  const backendIds = new Set(backendConversations.map((conversation) => conversation.id));
  const localOnly = localConversations.filter((conversation) => isLocalOnlyConversation(conversation) && !backendIds.has(conversation.id));
  return sortConversations([...merged, ...localOnly]);
}

function mapBackendConversation(item: BackendConversationInfo, friendById: Map<string, User>): Conversation {
  const groupId = item.groupId && item.groupId !== "0" ? item.groupId : undefined;
  const peerUserId = item.peerUserId && item.peerUserId !== "0" ? item.peerUserId : undefined;
  const isGroup = item.conversationType === 2 || Boolean(groupId);
  const friend = peerUserId ? friendById.get(peerUserId) : undefined;
  return {
    id: isGroup && groupId ? `group-${groupId}` : directConversationId(peerUserId ?? item.conversationId),
    backendConversationId: item.conversationId,
    type: isGroup ? "group" : "single",
    title: isGroup ? `Group ${groupId ?? item.conversationId}` : friend?.nickname ?? `User ${peerUserId ?? item.conversationId}`,
    avatar: friend?.avatar,
    online: isGroup ? undefined : friend ? friend.status === "online" : true,
    lastMessage: item.lastMessagePreview || "No messages yet",
    lastMessageAt: Number(item.lastMessageAt || item.updatedAt || Date.now()),
    unreadCount: item.unreadCount,
    pinned: item.pinned,
    muted: item.muted,
    targetUserId: isGroup ? undefined : peerUserId,
    groupId
  };
}

async function deliverMessage(conversation: Conversation, message: Message, updateStatus: (status: MessageStatus) => void) {
  const settings = useSettingsStore.getState();
  const userId = useAuthStore.getState().user?.id;
  const sequenceId = Date.now() % 1000000;

  if (!isNumericId(userId)) {
    throw new Error("Current user_id must be numeric.");
  }

  if (conversation.type === "group" && conversation.groupId) {
    if (!isNumericId(conversation.groupId)) {
      throw new Error("Group ID must be numeric.");
    }
    await sendBridgeGroupMessage(settings.bridgeHttpUrl, userId, conversation.groupId, message.content, sequenceId);
  } else {
    if (!isNumericId(conversation.targetUserId)) {
      throw new Error("Recipient user_id must be numeric.");
    }
    await sendBridgeSingleMessage(settings.bridgeHttpUrl, userId, conversation.targetUserId, message.content, sequenceId);
  }

  updateStatus("sent");
  updateStatus("delivered");
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversationId: {},
  gatewayStatus: {
    state: "disconnected",
    heartbeatOk: false,
    latency: 0
  },
  setActiveConversationId: (activeConversationId) => {
    set({ activeConversationId });
    if (activeConversationId) get().markConversationRead(activeConversationId);
  },
  loadConversations: async () => {
    const settings = useSettingsStore.getState();
    const userId = useAuthStore.getState().user?.id;
    if (!isNumericId(userId)) return;
    const conversations = await listBridgeConversations(settings.bridgeHttpUrl, userId);
    const friendById = new Map(useContactStore.getState().contacts.map((friend) => [friend.id, friend]));
    set((state) => {
      const mapped = mergeBackendConversations(state.conversations, conversations.map((item) => mapBackendConversation(item, friendById)));
      const activeStillExists = mapped.some((conversation) => conversation.id === state.activeConversationId);
      return {
        conversations: mapped,
        activeConversationId: activeStillExists ? state.activeConversationId : null
      };
    });
  },
  sendMessage: async (conversationId, content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const conversation = get().conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const userId = useAuthStore.getState().user?.id;
    if (!isNumericId(userId)) return;

    const message: Message = {
      id: createId("local"),
      conversationId,
      fromUserId: userId,
      toUserId: conversation.targetUserId,
      groupId: conversation.groupId,
      content: trimmed,
      contentType: "text",
      status: "sending",
      createdAt: Date.now(),
      isMine: true
    };

    set((state) => ({
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversationId]: [...(state.messagesByConversationId[conversationId] ?? []), message]
      },
      conversations: sortConversations(
        state.conversations.map((item) =>
          item.id === conversationId
            ? { ...item, lastMessage: trimmed, lastMessageAt: message.createdAt, unreadCount: 0 }
            : item
        )
      )
    }));

    try {
      await deliverMessage(conversation, message, (status) => get().updateMessageStatus(conversationId, message.id, status));
      void get().loadConversations().catch((error) => {
        clientLogger.warn("Reload conversations after send failed", error);
      });
    } catch (error) {
      clientLogger.warn("Message send failed", error);
      get().updateMessageStatus(conversationId, message.id, "failed");
    }
  },
  retryMessage: async (conversationId, messageId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const message = get().messagesByConversationId[conversationId]?.find((item) => item.id === messageId);
    if (!conversation || !message) return;
    get().updateMessageStatus(conversationId, messageId, "sending");
    try {
      await deliverMessage(conversation, message, (status) => get().updateMessageStatus(conversationId, messageId, status));
      void get().loadConversations().catch((error) => {
        clientLogger.warn("Reload conversations after retry failed", error);
      });
    } catch (error) {
      clientLogger.warn("Message retry failed", error);
      get().updateMessageStatus(conversationId, messageId, "failed");
    }
  },
  receiveMessage: (message) => {
    set((state) => {
      const conversationId = message.conversationId || conversationIdForIncoming(message);
      const normalizedMessage = { ...message, conversationId };
      const existingConversation = state.conversations.find((conversation) => conversation.id === conversationId);
      const isActive = state.activeConversationId === conversationId;
      let conversations: Conversation[];
      if (existingConversation) {
        conversations = state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                lastMessage: message.content,
                lastMessageAt: message.createdAt,
                unreadCount: isActive ? 0 : conversation.unreadCount + 1
              }
            : conversation
        );
      } else {
        const incomingConversation: Conversation = {
          id: conversationId,
          type: message.groupId ? "group" : "single",
          title: message.groupId ? `Group ${message.groupId}` : `User ${message.fromUserId}`,
          online: true,
          lastMessage: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: isActive ? 0 : 1,
          targetUserId: message.groupId ? undefined : message.fromUserId,
          groupId: message.groupId
        };
        conversations = [incomingConversation, ...state.conversations];
      }
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: [...(state.messagesByConversationId[conversationId] ?? []), normalizedMessage]
        },
        conversations: sortConversations(conversations)
      };
    });
  },
  markConversationRead: (conversationId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const settings = useSettingsStore.getState();
    const userId = useAuthStore.getState().user?.id;
    if (conversation?.backendConversationId && isNumericId(userId)) {
      void markBridgeConversationRead(settings.bridgeHttpUrl, userId, conversation.backendConversationId).catch((error) => {
        clientLogger.warn("Mark conversation read failed", error);
      });
    }
    set((state) => ({
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )
    }));
  },
  updateMessageStatus: (conversationId, messageId, status) => {
    set((state) => ({
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversationId]: (state.messagesByConversationId[conversationId] ?? []).map((message) =>
          message.id === messageId ? { ...message, status } : message
        )
      }
    }));
  },
  openConversationForUser: (user) => {
    const existing = get().conversations.find((conversation) => conversation.targetUserId === user.id);
    if (existing) {
      get().setActiveConversationId(existing.id);
      return existing.id;
    }

    const conversation: Conversation = {
      id: isNumericId(user.id) ? directConversationId(user.id) : createId("c"),
      type: "single",
      title: user.nickname,
      online: user.status === "online",
      lastMessage: "New conversation",
      lastMessageAt: Date.now(),
      unreadCount: 0,
      targetUserId: user.id
    };
    set((state) => ({ conversations: [conversation, ...state.conversations] }));
    get().setActiveConversationId(conversation.id);
    return conversation.id;
  },
  openConversationForGroup: (group) => {
    const existing = get().conversations.find((conversation) => conversation.groupId === group.id);
    if (existing) {
      get().setActiveConversationId(existing.id);
      return existing.id;
    }

    const conversation: Conversation = {
      id: isNumericId(group.id) ? `group-${group.id}` : createId("c"),
      backendConversationId: undefined,
      type: "group",
      title: group.name,
      lastMessage: "Group conversation ready",
      lastMessageAt: Date.now(),
      unreadCount: 0,
      groupId: group.id
    };
    set((state) => ({ conversations: [conversation, ...state.conversations] }));
    get().setActiveConversationId(conversation.id);
    return conversation.id;
  },
  setGatewayStatus: (gatewayStatus) => set({ gatewayStatus }),
  startGatewaySession: async () => {
    const gateway = getGatewayClient();
    gateway.onMessage(get().receiveMessage);
    gateway.onStatusChange(get().setGatewayStatus);
    await gateway.connect();
    try {
      await useContactStore.getState().loadFriends();
    } catch (error) {
      clientLogger.warn("Load friends failed", error);
    }
    try {
      await get().loadConversations();
    } catch (error) {
      clientLogger.warn("Load conversations failed", error);
    }
  },
  stopGatewaySession: () => {
    getGatewayClient().disconnect();
  },
  clearLocalChat: () =>
    set({
      conversations: [],
      activeConversationId: null,
      messagesByConversationId: {}
    })
}));
