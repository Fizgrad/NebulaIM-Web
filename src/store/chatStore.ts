import { create } from "zustand";
import type { Conversation } from "../types/conversation";
import type { Group } from "../types/group";
import type { Message, MessageStatus } from "../types/message";
import type { User } from "../types/user";
import type { GatewayStatus } from "../services/gatewayClient";
import { mockConversations } from "../mocks/conversations";
import { mockMessages } from "../mocks/messages";
import { useAuthStore } from "./authStore";
import { createId } from "../utils/id";
import { simulateDelivery } from "../services/messageService";
import { getGatewayClient } from "../services/gatewayClient";
import { useSettingsStore } from "./settingsStore";
import { clientLogger } from "../services/clientLogger";

type MessagesByConversationId = Record<string, Message[]>;

type ChatState = {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversationId: MessagesByConversationId;
  gatewayStatus: GatewayStatus;
  setActiveConversationId: (conversationId: string | null) => void;
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

function groupMessages(messages: Message[]) {
  return messages.reduce<MessagesByConversationId>((acc, message) => {
    acc[message.conversationId] = [...(acc[message.conversationId] ?? []), message];
    return acc;
  }, {});
}

function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

function isNumericId(value?: string) {
  return Boolean(value && /^\d+$/.test(value));
}

async function deliverMessage(conversation: Conversation, message: Message, updateStatus: (status: MessageStatus) => void) {
  const settings = useSettingsStore.getState();
  const gateway = getGatewayClient();
  const userId = useAuthStore.getState().user?.id ?? "u-current";
  const sequenceId = Date.now() % 1000000;
  let serverMessageId = message.id;

  if (settings.connectionMode === "real" && !isNumericId(userId)) {
    throw new Error("Real Bridge mode requires a numeric backend user_id from Gateway login.");
  }

  if (conversation.type === "group" && conversation.groupId) {
    if (settings.connectionMode === "real" && !isNumericId(conversation.groupId)) {
      throw new Error("Real Bridge mode requires numeric backend group_id.");
    }
    const result = await gateway.sendGroupMessage({
      conversationId: conversation.id,
      fromUserId: userId,
      groupId: conversation.groupId,
      content: message.content,
      contentType: "text",
      clientSequenceId: sequenceId
    });
    serverMessageId = result.messageId || message.id;
  } else {
    if (settings.connectionMode === "real" && !isNumericId(conversation.targetUserId)) {
      throw new Error("Real Bridge mode requires numeric backend to_user_id.");
    }
    const result = await gateway.sendSingleMessage({
      conversationId: conversation.id,
      fromUserId: userId,
      toUserId: conversation.targetUserId ?? "",
      content: message.content,
      contentType: "text",
      clientSequenceId: sequenceId
    });
    serverMessageId = result.messageId || message.id;
  }

  updateStatus("sent");
  await gateway.ackMessage(serverMessageId, userId);
  if (settings.connectionMode === "mock") {
    const delivered = await simulateDelivery(message.id);
    updateStatus(delivered.status);
  } else {
    updateStatus("delivered");
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: sortConversations(mockConversations.map((conversation) => ({ ...conversation }))),
  activeConversationId: "c-alice",
  messagesByConversationId: groupMessages(mockMessages.map((message) => ({ ...message }))),
  gatewayStatus: {
    state: "disconnected",
    heartbeatOk: false,
    latency: 0,
    mode: useSettingsStore.getState().connectionMode
  },
  setActiveConversationId: (activeConversationId) => {
    set({ activeConversationId });
    if (activeConversationId) get().markConversationRead(activeConversationId);
  },
  sendMessage: async (conversationId, content) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const conversation = get().conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const userId = useAuthStore.getState().user?.id ?? "u-current";
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
    } catch (error) {
      clientLogger.warn("Message retry failed", error);
      get().updateMessageStatus(conversationId, messageId, "failed");
    }
  },
  receiveMessage: (message) => {
    set((state) => {
      const isActive = state.activeConversationId === message.conversationId;
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [message.conversationId]: [...(state.messagesByConversationId[message.conversationId] ?? []), message]
        },
        conversations: sortConversations(
          state.conversations.map((conversation) =>
            conversation.id === message.conversationId
              ? {
                  ...conversation,
                  lastMessage: message.content,
                  lastMessageAt: message.createdAt,
                  unreadCount: isActive ? 0 : conversation.unreadCount + 1
                }
              : conversation
          )
        )
      };
    });
  },
  markConversationRead: (conversationId) => {
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
      id: createId("c"),
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
      id: createId("c"),
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
  },
  stopGatewaySession: () => {
    getGatewayClient().disconnect();
  },
  clearLocalChat: () =>
    set({
      conversations: sortConversations(mockConversations.map((conversation) => ({ ...conversation }))),
      activeConversationId: "c-alice",
      messagesByConversationId: groupMessages(mockMessages.map((message) => ({ ...message })))
    })
}));
