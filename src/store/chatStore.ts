import { create } from "zustand";
import type { Conversation } from "../types/conversation";
import type { Group } from "../types/group";
import type { Message, MessageContentType, MessageStatus } from "../types/message";
import type { User } from "../types/user";
import type { GatewayStatus } from "../services/gatewayClient";
import { useAuthStore } from "./authStore";
import { createId } from "../utils/id";
import { getGatewayClient } from "../services/gatewayClient";
import { isExpiredGatewaySession } from "../services/directGatewayClient";
import { useSettingsStore } from "./settingsStore";
import { useContactStore } from "./contactStore";
import { useGroupStore } from "./groupStore";
import { clientLogger } from "../services/clientLogger";
import {
  type BridgeMessageInfo,
  getBridgeMessagesReadState,
  getBridgePresence,
  getBridgeGroup,
  getBridgeUserInfo,
  listBridgeConversationMessages,
  listBridgeConversations,
  markBridgeConversationRead,
  sendBridgeGroupMessage,
  sendBridgeSingleMessage,
  uploadBridgeImage
} from "../api/bridgeApi";
import { translate, type TranslationKey } from "../i18n";

type MessagesByConversationId = Record<string, Message[]>;
type MessageHistoryState = {
  nextCursor: {
    before: number;
    beforeMessageId: string;
  } | null;
  hasMore: boolean;
  loadingOlder: boolean;
  olderPageRevision: number;
};
type MessageHistoryByConversationId = Record<string, MessageHistoryState>;

const resolvedUsers = new Map<string, User>();
type GroupSummary = Pick<Group, "id" | "name">;
const resolvedGroups = new Map<string, GroupSummary>();
const clientSequenceStorageKey = "nebulaim-client-sequence";
const maxClientSequence = 4_294_967_295;
let clientSequence = initialClientSequence();

function tr(key: TranslationKey) {
  return translate(useSettingsStore.getState().language, key);
}

type ChatState = {
  conversations: Conversation[];
  activeConversationId: string | null;
  messagesByConversationId: MessagesByConversationId;
  messageHistoryByConversationId: MessageHistoryByConversationId;
  gatewayStatus: GatewayStatus;
  setActiveConversationId: (conversationId: string | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadOlderMessages: (conversationId: string) => Promise<void>;
  refreshReadState: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  sendImageMessage: (conversationId: string, file: File) => Promise<void>;
  retryMessage: (conversationId: string, messageId: string) => Promise<void>;
  receiveMessage: (message: Message) => void;
  markConversationRead: (conversationId: string, upToMessageId?: string) => Promise<void>;
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

function initialClientSequence() {
  try {
    const stored = Number(window.localStorage.getItem(clientSequenceStorageKey) ?? 0);
    if (Number.isInteger(stored) && stored > 0 && stored <= maxClientSequence) return stored;
  } catch {
    // Ignore storage errors and fall back to a time-derived starting point.
  }
  return Date.now() % maxClientSequence;
}

function nextClientSequenceId() {
  clientSequence = (clientSequence % maxClientSequence) + 1;
  try {
    window.localStorage.setItem(clientSequenceStorageKey, String(clientSequence));
  } catch {
    // A volatile sequence is still better than reusing Date.now() for every send.
  }
  return clientSequence;
}

function directConversationId(userId: string) {
  return `direct-${userId}`;
}

function knownUser(userId: string) {
  return useContactStore.getState().contacts.find((contact) => contact.id === userId) ?? resolvedUsers.get(userId) ?? null;
}

function directConversationTitle(userId: string) {
  return knownUser(userId)?.nickname ?? `User ${userId}`;
}

function rememberUser(user: User) {
  resolvedUsers.set(user.id, user);
  return user;
}

async function loadPresence(baseUrl: string, userIds: string[]) {
  try {
    return await getBridgePresence(baseUrl, userIds);
  } catch {
    return {};
  }
}

async function resolveUserWithPresence(baseUrl: string, userId: string): Promise<User> {
  const user = await getBridgeUserInfo(baseUrl, userId);
  const presence = await loadPresence(baseUrl, [user.id]);
  const online = presence[user.id];
  return online === undefined ? user : { ...user, status: online ? "online" : "offline" };
}

function knownGroup(groupId?: string) {
  if (!groupId) return null;
  return useGroupStore.getState().groups.find((group) => group.id === groupId) ?? resolvedGroups.get(groupId) ?? null;
}

function rememberGroup<T extends GroupSummary>(group: T) {
  resolvedGroups.set(group.id, group);
  return group;
}

function groupConversationTitle(groupId?: string, fallbackId?: string) {
  return knownGroup(groupId)?.name ?? `Group ${groupId ?? fallbackId ?? ""}`.trim();
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

function isFallbackGroupTitle(conversation: Conversation) {
  return conversation.type === "group" && conversation.title === groupConversationTitle(undefined, conversation.groupId ?? conversation.backendConversationId);
}

function selectConversationTitle(localConversation: Conversation, backendConversation: Conversation) {
  if (isFallbackGroupTitle(backendConversation)) return localConversation.title || backendConversation.title;
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

function applyUserToConversation(conversation: Conversation, user: User): Conversation {
  if (conversation.type !== "single" || conversation.targetUserId !== user.id) return conversation;
  return {
    ...conversation,
    title: user.nickname || user.username || conversation.title,
    avatar: user.avatar ?? conversation.avatar,
    online: user.status === "online"
  };
}

function applyUserToMessage(message: Message, user: User): Message {
  if (message.fromUserId !== user.id) return message;
  return {
    ...message,
    senderName: user.nickname || user.username || message.senderName,
    senderAvatar: user.avatar ?? message.senderAvatar
  };
}

function applyGroupToConversation(conversation: Conversation, group: GroupSummary): Conversation {
  if (conversation.type !== "group" || conversation.groupId !== group.id) return conversation;
  return {
    ...conversation,
    title: group.name || conversation.title
  };
}

function mapBackendConversation(item: BackendConversationInfo, friendById: Map<string, User>): Conversation {
  const groupId = item.groupId && item.groupId !== "0" ? item.groupId : undefined;
  const peerUserId = item.peerUserId && item.peerUserId !== "0" ? item.peerUserId : undefined;
  const isGroup = item.conversationType === 2 || Boolean(groupId);
  const friend = peerUserId ? friendById.get(peerUserId) : undefined;
  const groupName = isGroup ? item.groupName || knownGroup(groupId)?.name : undefined;
  return {
    id: isGroup && groupId ? `group-${groupId}` : directConversationId(peerUserId ?? item.conversationId),
    backendConversationId: item.conversationId,
    type: isGroup ? "group" : "single",
    title: isGroup ? groupName ?? groupConversationTitle(groupId, item.conversationId) : friend?.nickname ?? `User ${peerUserId ?? item.conversationId}`,
    avatar: friend?.avatar,
    online: isGroup ? undefined : friend ? friend.status === "online" : false,
    lastMessage: conversationPreviewFromBackend(item.lastMessagePreview),
    lastMessageId: item.lastMessageId,
    lastMessageAt: requiredBackendTimestamp(item.lastMessageAt || item.updatedAt, "conversation timestamp"),
    unreadCount: item.unreadCount,
    pinned: item.pinned,
    muted: item.muted,
    targetUserId: isGroup ? undefined : peerUserId,
    groupId
  };
}

function messageStatusFromBackend(status: number, isMine: boolean): MessageStatus {
  if (status === 4) return "failed";
  if (status === 5) return "read";
  if (!isMine) return "delivered";
  if (status === 1) return "sent";
  return "delivered";
}

function requiredBackendTimestamp(value: number | string | undefined, field: string) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error(`Bridge returned an invalid ${field}.`);
  }
  return timestamp;
}

function messageContentTypeFromBackend(contentType: number): MessageContentType {
  return contentType === 2 ? "image" : "text";
}

function messagePreview(content: string, contentType: MessageContentType) {
  return contentType === "image" ? tr("store.imageMessage") : content;
}

function isImageUrl(value: string) {
  try {
    const url = new URL(value, "http://nebulaim.local");
    return /\/(?:uploads|media)\/images\/[^/]+\.(png|jpe?g|webp|gif)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function conversationPreviewFromBackend(preview: string) {
  if (!preview) return tr("store.noMessagesYet");
  if (preview === "__NEBULA_MESSAGE_RECALLED__") return tr("store.messageRecalled");
  return isImageUrl(preview) ? tr("store.imageMessage") : preview;
}

function mapBridgeMessage(item: BridgeMessageInfo, conversationId: string, currentUserId: string): Message {
  const groupId = item.groupId && item.groupId !== "0" ? item.groupId : undefined;
  const toUserId = item.toUserId && item.toUserId !== "0" ? item.toUserId : undefined;
  const isMine = item.fromUserId === currentUserId;
  const sender = isMine ? useAuthStore.getState().user : knownUser(item.fromUserId);
  return {
    id: item.messageId,
    conversationId,
    fromUserId: item.fromUserId,
    toUserId,
    groupId,
    senderName: sender?.nickname,
    senderAvatar: sender?.avatar,
    content: item.recalled ? tr("store.messageRecalled") : item.content,
    contentType: item.recalled ? "text" : messageContentTypeFromBackend(item.contentType),
    status: messageStatusFromBackend(item.status, isMine),
    createdAt: requiredBackendTimestamp(item.createdAt, "message timestamp"),
    isMine,
    recalled: item.recalled,
    recalledAt: Number(item.recalledAt ?? 0)
  };
}

function isLikelyOptimisticDuplicate(existing: Message, incoming: Message) {
  return (
    existing.id.startsWith("local_") &&
    existing.fromUserId === incoming.fromUserId &&
    existing.toUserId === incoming.toUserId &&
    existing.groupId === incoming.groupId &&
    existing.content === incoming.content &&
    Math.abs(existing.createdAt - incoming.createdAt) <= 5 * 60 * 1000
  );
}

function mergeMessages(existing: Message[], incoming: Message[]) {
  const incomingIds = new Set(incoming.map((message) => message.id));
  const filteredExisting = existing.filter(
    (message) => !incomingIds.has(message.id) && !incoming.some((incomingMessage) => isLikelyOptimisticDuplicate(message, incomingMessage))
  );
  return [...filteredExisting, ...incoming].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

async function deliverMessage(conversation: Conversation, message: Message, updateStatus: (status: MessageStatus) => void) {
  const settings = useSettingsStore.getState();
  const userId = useAuthStore.getState().user?.id;
  const sequenceId = nextClientSequenceId();

  if (!isNumericId(userId)) {
    throw new Error(tr("store.currentUserNumeric"));
  }

  if (conversation.type === "group" && conversation.groupId) {
    if (!isNumericId(conversation.groupId)) {
      throw new Error(tr("store.groupIdNumeric"));
    }
    const result = await sendBridgeGroupMessage(settings.bridgeHttpUrl, conversation.groupId, message.content, sequenceId, message.contentType);
    updateStatus("sent");
    return result;
  } else {
    if (!isNumericId(conversation.targetUserId)) {
      throw new Error(tr("store.recipientNumeric"));
    }
    const result = await sendBridgeSingleMessage(settings.bridgeHttpUrl, conversation.targetUserId, message.content, sequenceId, message.contentType);
    updateStatus("sent");
    return result;
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messagesByConversationId: {},
  messageHistoryByConversationId: {},
  gatewayStatus: {
    state: "disconnected",
    heartbeatOk: false,
    latency: 0
  },
  setActiveConversationId: (activeConversationId) => {
    set({ activeConversationId });
    if (activeConversationId) {
      void (async () => {
        await get().loadMessages(activeConversationId);
        await get().markConversationRead(activeConversationId);
        await get().loadConversations();
      })().catch((error) => {
        clientLogger.warn("Open conversation failed", error);
      });
    }
  },
  loadConversations: async () => {
    const settings = useSettingsStore.getState();
    const userId = useAuthStore.getState().user?.id;
    if (!isNumericId(userId)) return;
    const conversations = await listBridgeConversations(settings.bridgeHttpUrl);
    conversations.forEach((item) => {
      const groupId = item.groupId && item.groupId !== "0" ? item.groupId : undefined;
      if (groupId && item.groupName) {
        rememberGroup({
          id: groupId,
          name: item.groupName
        });
      }
    });
    const friendById = new Map(useContactStore.getState().contacts.map((friend) => [friend.id, friend]));
    set((state) => {
      const mapped = mergeBackendConversations(state.conversations, conversations.map((item) => mapBackendConversation(item, friendById)));
      const normalized = mapped.map((conversation) =>
        conversation.id === state.activeConversationId ? { ...conversation, unreadCount: 0 } : conversation
      );
      const activeStillExists = mapped.some((conversation) => conversation.id === state.activeConversationId);
      return {
        conversations: normalized,
        activeConversationId: activeStillExists ? state.activeConversationId : null
      };
    });
    const missingPeerIds = conversations
      .map((item) => (item.peerUserId && item.peerUserId !== "0" && !friendById.has(item.peerUserId) ? item.peerUserId : ""))
      .filter((peerId): peerId is string => Boolean(peerId));
    const peerIds = Array.from(
      new Set(
        conversations
          .map((item) => (item.peerUserId && item.peerUserId !== "0" ? item.peerUserId : ""))
          .filter((peerId): peerId is string => Boolean(peerId))
      )
    );
    if (peerIds.length > 0) {
      void loadPresence(settings.bridgeHttpUrl, peerIds)
        .then((presence) => {
          for (const [userId, online] of Object.entries(presence)) {
            const cached = resolvedUsers.get(userId);
            if (cached) {
              resolvedUsers.set(userId, { ...cached, status: online ? "online" : "offline" });
            }
          }
          set((state) => ({
            conversations: state.conversations.map((conversation) =>
              conversation.type === "single" && conversation.targetUserId && presence[conversation.targetUserId] !== undefined
                ? { ...conversation, online: presence[conversation.targetUserId] }
                : conversation
            )
          }));
        })
        .catch((error) => {
          clientLogger.warn("Refresh conversation presence failed", error);
        });
    }
    for (const peerId of Array.from(new Set(missingPeerIds))) {
      void resolveUserWithPresence(settings.bridgeHttpUrl, peerId)
        .then(rememberUser)
        .then((user) => {
          set((state) => ({ conversations: state.conversations.map((conversation) => applyUserToConversation(conversation, user)) }));
        })
        .catch((error) => {
          clientLogger.warn("Resolve conversation user failed", error);
        });
    }
    const missingGroupIds = conversations
      .map((item) => {
        const groupId = item.groupId && item.groupId !== "0" ? item.groupId : "";
        return groupId && !item.groupName && !knownGroup(groupId) ? groupId : "";
      })
      .filter((groupId): groupId is string => Boolean(groupId));
    for (const groupId of Array.from(new Set(missingGroupIds))) {
      void getBridgeGroup(settings.bridgeHttpUrl, groupId)
        .then(rememberGroup)
        .then((group) => {
          set((state) => ({ conversations: state.conversations.map((conversation) => applyGroupToConversation(conversation, group)) }));
        })
        .catch((error) => {
          clientLogger.warn("Resolve conversation group failed", error);
        });
    }
  },
  loadMessages: async (conversationId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const settings = useSettingsStore.getState();
    const userId = useAuthStore.getState().user?.id;
    if (!conversation?.backendConversationId || !isNumericId(userId)) return;

    const history = await listBridgeConversationMessages(settings.bridgeHttpUrl, conversation.backendConversationId);
    const messages = history.messages.map((item) => mapBridgeMessage(item, conversation.id, userId));
    set((state) => ({
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversation.id]: mergeMessages(state.messagesByConversationId[conversation.id] ?? [], messages)
      },
      messageHistoryByConversationId: {
        ...state.messageHistoryByConversationId,
        [conversation.id]:
          state.messageHistoryByConversationId[conversation.id] ?? {
            nextCursor: history.nextCursor,
            hasMore: history.hasMore,
            loadingOlder: false,
            olderPageRevision: 0
          }
      }
    }));
    const missingSenderIds = Array.from(
      new Set(messages.map((message) => message.fromUserId).filter((fromUserId) => fromUserId !== userId && !knownUser(fromUserId)))
    );
    for (const senderId of missingSenderIds) {
      void resolveUserWithPresence(settings.bridgeHttpUrl, senderId)
        .then(rememberUser)
        .then((user) => {
          set((state) => ({
            conversations: state.conversations.map((item) => applyUserToConversation(item, user)),
            messagesByConversationId: Object.fromEntries(
              Object.entries(state.messagesByConversationId).map(([key, values]) => [
                key,
                values.map((message) => applyUserToMessage(message, user))
              ])
            )
          }));
        })
        .catch((error) => {
          clientLogger.warn("Resolve message sender failed", error);
        });
    }

    void get().refreshReadState(conversationId).catch((error) => {
      clientLogger.warn("Refresh read state failed", error);
    });
  },
  loadOlderMessages: async (conversationId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const settings = useSettingsStore.getState();
    const userId = useAuthStore.getState().user?.id;
    const historyState = get().messageHistoryByConversationId[conversationId];
    if (
      !conversation?.backendConversationId ||
      !isNumericId(userId) ||
      !historyState?.hasMore ||
      !historyState.nextCursor ||
      historyState.loadingOlder
    ) {
      return;
    }

    set((state) => ({
      messageHistoryByConversationId: {
        ...state.messageHistoryByConversationId,
        [conversationId]: {
          ...state.messageHistoryByConversationId[conversationId],
          loadingOlder: true
        }
      }
    }));

    try {
      const history = await listBridgeConversationMessages(
        settings.bridgeHttpUrl,
        conversation.backendConversationId,
        historyState.nextCursor.before,
        50,
        historyState.nextCursor.beforeMessageId
      );
      const messages = history.messages.map((item) => mapBridgeMessage(item, conversation.id, userId));
      set((state) => {
        const currentHistory = state.messageHistoryByConversationId[conversationId];
        return {
          messagesByConversationId: {
            ...state.messagesByConversationId,
            [conversationId]: mergeMessages(state.messagesByConversationId[conversationId] ?? [], messages)
          },
          messageHistoryByConversationId: {
            ...state.messageHistoryByConversationId,
            [conversationId]: {
              nextCursor: history.nextCursor,
              hasMore: history.hasMore,
              loadingOlder: false,
              olderPageRevision: (currentHistory?.olderPageRevision ?? 0) + 1
            }
          }
        };
      });
      const missingSenderIds = Array.from(
        new Set(messages.map((message) => message.fromUserId).filter((fromUserId) => fromUserId !== userId && !knownUser(fromUserId)))
      );
      for (const senderId of missingSenderIds) {
        void resolveUserWithPresence(settings.bridgeHttpUrl, senderId)
          .then(rememberUser)
          .then((user) => {
            set((state) => ({
              messagesByConversationId: {
                ...state.messagesByConversationId,
                [conversationId]: (state.messagesByConversationId[conversationId] ?? []).map((message) =>
                  applyUserToMessage(message, user)
                )
              }
            }));
          })
          .catch((error) => {
            clientLogger.warn("Resolve older message sender failed", error);
          });
      }
    } catch (error) {
      set((state) => ({
        messageHistoryByConversationId: {
          ...state.messageHistoryByConversationId,
          [conversationId]: {
            ...state.messageHistoryByConversationId[conversationId],
            loadingOlder: false
          }
        }
      }));
      throw error;
    }
  },
  refreshReadState: async (conversationId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const settings = useSettingsStore.getState();
    const currentUserId = useAuthStore.getState().user?.id;
    if (!conversation) return;

    const currentMessages = get().messagesByConversationId[conversationId] ?? [];
    const myDeliveredMessages = currentMessages.filter(
      (message) => message.isMine && !message.id.startsWith("local_") && (message.status === "sent" || message.status === "delivered")
    );
    if (myDeliveredMessages.length === 0) return;

    try {
      const readStateMap = await getBridgeMessagesReadState(
        settings.bridgeHttpUrl,
        myDeliveredMessages.map((message) => message.id)
      );
      set((state) => {
        const existing = state.messagesByConversationId[conversationId] ?? [];
        const updated = existing.map((message) => {
          if (!message.isMine || message.id.startsWith("local_")) return message;
          if (message.status === "read" || message.status === "failed") return message;
          const states = readStateMap[message.id] ?? [];
          const peerStates = states.filter((stateItem) => String(stateItem.userId) !== String(currentUserId));
          if (peerStates.length === 0) return message;
          const anyRead = peerStates.some((stateItem) => Number(stateItem.readAt) > 0);
          if (anyRead) return { ...message, status: "read" as MessageStatus };
          const anyDelivered = peerStates.some((stateItem) => Number(stateItem.deliveredAt) > 0);
          if (anyDelivered) return { ...message, status: "delivered" as MessageStatus };
          return message;
        });
        return {
          messagesByConversationId: {
            ...state.messagesByConversationId,
            [conversationId]: updated
          }
        };
      });
    } catch (error) {
      clientLogger.warn("Fetch read state failed", error);
    }
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
      senderName: useAuthStore.getState().user?.nickname,
      senderAvatar: useAuthStore.getState().user?.avatar,
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
            ? { ...item, lastMessage: messagePreview(trimmed, "text"), lastMessageAt: message.createdAt, unreadCount: 0 }
            : item
        )
      )
    }));

    try {
      const result = await deliverMessage(conversation, message, (status) => get().updateMessageStatus(conversationId, message.id, status));
      set((state) => ({
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: (state.messagesByConversationId[conversationId] ?? []).map((item) =>
            item.id === message.id ? { ...item, id: result.messageId || item.id, createdAt: result.serverTimestamp || item.createdAt } : item
          )
        }
      }));
      await get().loadConversations();
      await get().loadMessages(conversationId);
    } catch (error) {
      clientLogger.warn("Message send failed", error);
      get().updateMessageStatus(conversationId, message.id, "failed");
    }
  },
  sendImageMessage: async (conversationId, file) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const userId = useAuthStore.getState().user?.id;
    if (!isNumericId(userId)) return;

    const settings = useSettingsStore.getState();
    const dataUrl = await fileToDataUrl(file);
    const uploaded = await uploadBridgeImage(settings.bridgeHttpUrl, dataUrl, file.name);

    const message: Message = {
      id: createId("local"),
      conversationId,
      fromUserId: userId,
      toUserId: conversation.targetUserId,
      groupId: conversation.groupId,
      senderName: useAuthStore.getState().user?.nickname,
      senderAvatar: useAuthStore.getState().user?.avatar,
      content: uploaded.url,
      contentType: "image",
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
            ? { ...item, lastMessage: messagePreview(message.content, message.contentType), lastMessageAt: message.createdAt, unreadCount: 0 }
            : item
        )
      )
    }));

    try {
      const result = await deliverMessage(conversation, message, (status) => get().updateMessageStatus(conversationId, message.id, status));
      set((state) => ({
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: (state.messagesByConversationId[conversationId] ?? []).map((item) =>
            item.id === message.id ? { ...item, id: result.messageId || item.id, createdAt: result.serverTimestamp || item.createdAt } : item
          )
        }
      }));
      await get().loadConversations();
      await get().loadMessages(conversationId);
    } catch (error) {
      clientLogger.warn("Image message send failed", error);
      get().updateMessageStatus(conversationId, message.id, "failed");
    }
  },
  retryMessage: async (conversationId, messageId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const message = get().messagesByConversationId[conversationId]?.find((item) => item.id === messageId);
    if (!conversation || !message) return;
    get().updateMessageStatus(conversationId, messageId, "sending");
    try {
      const result = await deliverMessage(conversation, message, (status) => get().updateMessageStatus(conversationId, messageId, status));
      set((state) => ({
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: (state.messagesByConversationId[conversationId] ?? []).map((item) =>
            item.id === messageId ? { ...item, id: result.messageId || item.id, createdAt: result.serverTimestamp || item.createdAt } : item
          )
        }
      }));
      await get().loadConversations();
      await get().loadMessages(conversationId);
    } catch (error) {
      clientLogger.warn("Message retry failed", error);
      get().updateMessageStatus(conversationId, messageId, "failed");
    }
  },
  receiveMessage: async (message) => {
    const currentUser = useAuthStore.getState().user;
    const senderUser = message.isMine ? currentUser ?? null : knownUser(message.fromUserId);
    const group = knownGroup(message.groupId);
    set((state) => {
      const conversationId = message.conversationId || conversationIdForIncoming(message);
      const normalizedMessage: Message = {
        ...message,
        conversationId,
        senderName: senderUser?.nickname ?? message.senderName,
        senderAvatar: senderUser?.avatar ?? message.senderAvatar,
        content: message.recalled ? tr("store.messageRecalled") : message.content,
        contentType: message.recalled ? "text" : message.contentType
      };
      const existingMessages = state.messagesByConversationId[conversationId] ?? [];
      const alreadySeen = existingMessages.some((item) => item.id === normalizedMessage.id);
      const existingConversation = state.conversations.find((conversation) => conversation.id === conversationId);
      const isActive = state.activeConversationId === conversationId;
      const shouldCountUnread = !normalizedMessage.isMine && !isActive && !alreadySeen && !normalizedMessage.recalled;
      const eventTime = normalizedMessage.recalledAt || normalizedMessage.createdAt;
      let conversations: Conversation[];
      if (existingConversation) {
        conversations = state.conversations.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                title: group ? group.name : conversation.title,
                online: message.groupId ? conversation.online : senderUser ? senderUser.status === "online" : conversation.online ?? false,
                lastMessage:
                  !normalizedMessage.recalled || !conversation.lastMessageId || conversation.lastMessageId === normalizedMessage.id
                    ? messagePreview(normalizedMessage.content, normalizedMessage.contentType)
                    : conversation.lastMessage,
                lastMessageId: normalizedMessage.recalled
                  ? conversation.lastMessageId ?? normalizedMessage.id
                  : normalizedMessage.id,
                lastMessageAt:
                  !normalizedMessage.recalled || !conversation.lastMessageId || conversation.lastMessageId === normalizedMessage.id
                    ? eventTime
                    : conversation.lastMessageAt,
                unreadCount: shouldCountUnread ? conversation.unreadCount + 1 : conversation.unreadCount
              }
            : conversation
        );
      } else {
        const incomingConversation: Conversation = {
          id: conversationId,
          type: message.groupId ? "group" : "single",
          title: message.groupId ? groupConversationTitle(message.groupId) : senderUser?.nickname ?? directConversationTitle(message.fromUserId),
          avatar: senderUser?.avatar,
          online: message.groupId ? undefined : senderUser ? senderUser.status === "online" : false,
          lastMessage: messagePreview(normalizedMessage.content, normalizedMessage.contentType),
          lastMessageId: normalizedMessage.id,
          lastMessageAt: eventTime,
          unreadCount: shouldCountUnread ? 1 : 0,
          targetUserId: message.groupId ? undefined : message.fromUserId,
          groupId: message.groupId
        };
        conversations = [incomingConversation, ...state.conversations];
      }
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: mergeMessages(existingMessages, [normalizedMessage])
        },
        conversations: sortConversations(conversations)
      };
    });
    const conversationId = message.conversationId || conversationIdForIncoming(message);
    const settings = useSettingsStore.getState();
    const applyResolvedUser = (user: User) => {
      set((state) => ({
        conversations: state.conversations.map((conversation) => applyUserToConversation(conversation, user)),
        messagesByConversationId: Object.fromEntries(
          Object.entries(state.messagesByConversationId).map(([key, messages]) => [
            key,
            messages.map((item) => applyUserToMessage(item, user))
          ])
        )
      }));
    };
    if (senderUser) {
      applyResolvedUser(senderUser);
    } else {
      void resolveUserWithPresence(settings.bridgeHttpUrl, message.fromUserId)
        .then(rememberUser)
        .then(applyResolvedUser)
        .catch((error) => {
          clientLogger.warn("Resolve incoming message user failed", error);
        });
    }
    if (message.groupId) {
      const applyResolvedGroup = (resolvedGroup: GroupSummary) => {
        set((state) => ({ conversations: state.conversations.map((conversation) => applyGroupToConversation(conversation, resolvedGroup)) }));
      };
      if (group) {
        applyResolvedGroup(group);
      } else {
        void getBridgeGroup(settings.bridgeHttpUrl, message.groupId)
          .then(rememberGroup)
          .then(applyResolvedGroup)
          .catch((error) => {
            clientLogger.warn("Resolve incoming message group failed", error);
          });
      }
    }

    if (!message.isMine && !message.id.startsWith("local_") && isNumericId(currentUser?.id) && /^\d+$/.test(message.id)) {
      try {
        await getGatewayClient().ackMessage(message.id, currentUser!.id);
      } catch (error) {
        clientLogger.warn("Ack incoming message failed", error);
      }
    }
    if (!message.isMine && get().activeConversationId === conversationId) {
      await get().markConversationRead(conversationId, message.id).catch((error) => {
        clientLogger.warn("Mark active incoming conversation read failed", error);
      });
    }

    void get()
      .loadConversations()
      .then(() => get().loadMessages(conversationId))
      .catch((error) => {
        clientLogger.warn("Reload conversations after incoming message failed", error);
      });
  },
  markConversationRead: async (conversationId, upToMessageId) => {
    const conversation = get().conversations.find((item) => item.id === conversationId);
    const settings = useSettingsStore.getState();
    const userId = useAuthStore.getState().user?.id;
    const readCursor =
      upToMessageId ??
      [...(get().messagesByConversationId[conversationId] ?? [])]
        .reverse()
        .find((message) => !message.id.startsWith("local_") && isNumericId(message.id))?.id;
    if (conversation?.backendConversationId && isNumericId(userId)) {
      if (!readCursor) return;
      await markBridgeConversationRead(settings.bridgeHttpUrl, conversation.backendConversationId, readCursor);
    }
    set((state) => ({
      conversations: state.conversations.map((item) =>
        item.id === conversationId ? { ...item, unreadCount: 0 } : item
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
      lastMessage: tr("store.newConversation"),
      lastMessageAt: Date.now(),
      unreadCount: 0,
      targetUserId: user.id
    };
    set((state) => ({ conversations: [conversation, ...state.conversations] }));
    get().setActiveConversationId(conversation.id);
    return conversation.id;
  },
  openConversationForGroup: (group) => {
    rememberGroup(group);
    const existing = get().conversations.find((conversation) => conversation.groupId === group.id);
    if (existing) {
      set((state) => ({ conversations: state.conversations.map((conversation) => applyGroupToConversation(conversation, group)) }));
      get().setActiveConversationId(existing.id);
      return existing.id;
    }

    const conversation: Conversation = {
      id: isNumericId(group.id) ? `group-${group.id}` : createId("c"),
      backendConversationId: undefined,
      type: "group",
      title: group.name,
      lastMessage: tr("store.groupConversationReady"),
      lastMessageAt: Date.now(),
      unreadCount: 0,
      groupId: group.id
    };
    set((state) => ({ conversations: [conversation, ...state.conversations] }));
    get().setActiveConversationId(conversation.id);
    return conversation.id;
  },
  setGatewayStatus: (gatewayStatus) => {
    set({ gatewayStatus });
    if (gatewayStatus.sessionExpired) {
      void useAuthStore.getState().logout(false);
      get().clearLocalChat();
    }
  },
  startGatewaySession: async () => {
    const gateway = getGatewayClient();
    const auth = useAuthStore.getState();
    if (!auth.token || !auth.user?.id) {
      await auth.logout(false);
      throw new Error(tr("store.sessionExpired"));
    }
    gateway.setSession(auth.token, auth.user.id);
    gateway.onMessage(get().receiveMessage);
    gateway.onStatusChange(get().setGatewayStatus);
    try {
      await gateway.connect();
    } catch (error) {
      if (isExpiredGatewaySession(error)) {
        await useAuthStore.getState().logout(false);
      }
      throw error;
    }
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
      messagesByConversationId: {},
      messageHistoryByConversationId: {}
    })
}));
