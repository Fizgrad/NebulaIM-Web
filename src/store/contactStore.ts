import { create } from "zustand";
import type { BridgeFriendRequest } from "../api/bridgeApi";
import type { User } from "../types/user";
import {
  acceptBridgeFriendRequest,
  deleteBridgeFriend,
  getBridgePresence,
  getBridgeUserByUsername,
  getBridgeUserInfo,
  listBridgeFriendRequests,
  listBridgeFriends,
  rejectBridgeFriendRequest,
  sendBridgeFriendRequest
} from "../api/bridgeApi";
import { useAuthStore } from "./authStore";
import { useSettingsStore } from "./settingsStore";
import { translate, type TranslationKey } from "../i18n";

export type FriendRequestView = BridgeFriendRequest & {
  direction: "incoming" | "outgoing";
  peer: User;
};

type ContactState = {
  contacts: User[];
  incomingRequests: FriendRequestView[];
  outgoingRequests: FriendRequestView[];
  isLoading: boolean;
  isSendingRequest: boolean;
  error: string | null;
  notice: string | null;
  loadFriends: () => Promise<void>;
  refreshPresence: () => Promise<void>;
  sendFriendRequest: (identifier: string, message?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  deleteFriend: (userId: string) => Promise<void>;
  clearNotice: () => void;
};

function tr(key: TranslationKey) {
  return translate(useSettingsStore.getState().language, key);
}

function requireNumericId(value: string | undefined, label: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be numeric.`);
  }
  return value;
}

async function resolveFriendUserId(baseUrl: string, identifier: string) {
  const value = identifier.trim();
  if (!value) {
    throw new Error(tr("store.friendIdentifierRequired"));
  }
  if (/^\d+$/.test(value)) {
    return value;
  }
  const user = await getBridgeUserByUsername(baseUrl, value);
  return requireNumericId(user.id, "Resolved friend user_id");
}

function fallbackUser(userId: string): User {
  return {
    id: userId,
    username: "",
    nickname: `#${userId}`,
    avatarColor: "from-cyan-500 to-blue-500",
    status: "offline"
  };
}

async function loadPresence(baseUrl: string, userIds: string[]) {
  try {
    return await getBridgePresence(baseUrl, userIds);
  } catch {
    return {};
  }
}

function applyPresence(user: User, presence: Record<string, boolean>): User {
  const online = presence[user.id];
  if (online === undefined) return user;
  return {
    ...user,
    status: online ? "online" : "offline"
  };
}

function applyRequestPresence(request: FriendRequestView, presence: Record<string, boolean>): FriendRequestView {
  return {
    ...request,
    peer: applyPresence(request.peer, presence)
  };
}

async function hydrateRequests(baseUrl: string, requests: BridgeFriendRequest[], currentUserId: string, direction: "incoming" | "outgoing") {
  return Promise.all(
    requests.map(async (request): Promise<FriendRequestView> => {
      const peerId = direction === "incoming" ? request.fromUserId : request.toUserId;
      try {
        const peer = await getBridgeUserInfo(baseUrl, peerId);
        return { ...request, direction, peer };
      } catch {
        return { ...request, direction, peer: fallbackUser(peerId || currentUserId) };
      }
    })
  );
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [],
  incomingRequests: [],
  outgoingRequests: [],
  isLoading: false,
  isSendingRequest: false,
  error: null,
  notice: null,
  loadFriends: async () => {
    const settings = useSettingsStore.getState();
    const userId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    set({ isLoading: true, error: null });
    try {
      const [contacts, incoming, outgoing] = await Promise.all([
        listBridgeFriends(settings.bridgeHttpUrl),
        listBridgeFriendRequests(settings.bridgeHttpUrl, true, 0),
        listBridgeFriendRequests(settings.bridgeHttpUrl, false, 0)
      ]);
      const [incomingRequests, outgoingRequests] = await Promise.all([
        hydrateRequests(settings.bridgeHttpUrl, incoming, userId, "incoming"),
        hydrateRequests(settings.bridgeHttpUrl, outgoing, userId, "outgoing")
      ]);
      const presence = await loadPresence(settings.bridgeHttpUrl, [
        ...contacts.map((contact) => contact.id),
        ...incomingRequests.map((request) => request.peer.id),
        ...outgoingRequests.map((request) => request.peer.id)
      ]);
      set({
        contacts: contacts.map((contact) => applyPresence(contact, presence)),
        incomingRequests: incomingRequests.map((request) => applyRequestPresence(request, presence)),
        outgoingRequests: outgoingRequests.map((request) => applyRequestPresence(request, presence)),
        isLoading: false,
        error: null
      });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : tr("store.failedLoadFriends") });
    }
  },
  refreshPresence: async () => {
    const settings = useSettingsStore.getState();
    const state = useContactStore.getState();
    const presence = await loadPresence(settings.bridgeHttpUrl, [
      ...state.contacts.map((contact) => contact.id),
      ...state.incomingRequests.map((request) => request.peer.id),
      ...state.outgoingRequests.map((request) => request.peer.id)
    ]);
    set((current) => ({
      contacts: current.contacts.map((contact) => applyPresence(contact, presence)),
      incomingRequests: current.incomingRequests.map((request) => applyRequestPresence(request, presence)),
      outgoingRequests: current.outgoingRequests.map((request) => applyRequestPresence(request, presence))
    }));
  },
  sendFriendRequest: async (identifier, message = "") => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    set({ isSendingRequest: true, error: null, notice: null });
    try {
      const toUserId = await resolveFriendUserId(settings.bridgeHttpUrl, identifier);
      if (toUserId === currentUserId) {
        throw new Error(tr("store.friendRequestSelf"));
      }
      await sendBridgeFriendRequest(settings.bridgeHttpUrl, toUserId, message.trim());
      const [incoming, outgoing] = await Promise.all([
        listBridgeFriendRequests(settings.bridgeHttpUrl, true, 0),
        listBridgeFriendRequests(settings.bridgeHttpUrl, false, 0)
      ]);
      const [incomingRequests, outgoingRequests] = await Promise.all([
        hydrateRequests(settings.bridgeHttpUrl, incoming, currentUserId, "incoming"),
        hydrateRequests(settings.bridgeHttpUrl, outgoing, currentUserId, "outgoing")
      ]);
      const presence = await loadPresence(settings.bridgeHttpUrl, [
        ...incomingRequests.map((request) => request.peer.id),
        ...outgoingRequests.map((request) => request.peer.id)
      ]);
      set({
        incomingRequests: incomingRequests.map((request) => applyRequestPresence(request, presence)),
        outgoingRequests: outgoingRequests.map((request) => applyRequestPresence(request, presence)),
        isSendingRequest: false,
        error: null,
        notice: tr("store.friendRequestSent")
      });
    } catch (error) {
      set({ isSendingRequest: false, error: error instanceof Error ? error.message : tr("store.failedSendFriendRequest") });
      throw error;
    }
  },
  acceptFriendRequest: async (requestId) => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    const friendRequestId = requireNumericId(requestId, "Friend request id");
    set({ isLoading: true, error: null });
    try {
      await acceptBridgeFriendRequest(settings.bridgeHttpUrl, friendRequestId);
      const [contacts, incoming, outgoing] = await Promise.all([
        listBridgeFriends(settings.bridgeHttpUrl),
        listBridgeFriendRequests(settings.bridgeHttpUrl, true, 0),
        listBridgeFriendRequests(settings.bridgeHttpUrl, false, 0)
      ]);
      const [incomingRequests, outgoingRequests] = await Promise.all([
        hydrateRequests(settings.bridgeHttpUrl, incoming, currentUserId, "incoming"),
        hydrateRequests(settings.bridgeHttpUrl, outgoing, currentUserId, "outgoing")
      ]);
      const presence = await loadPresence(settings.bridgeHttpUrl, [
        ...contacts.map((contact) => contact.id),
        ...incomingRequests.map((request) => request.peer.id),
        ...outgoingRequests.map((request) => request.peer.id)
      ]);
      set({
        contacts: contacts.map((contact) => applyPresence(contact, presence)),
        incomingRequests: incomingRequests.map((request) => applyRequestPresence(request, presence)),
        outgoingRequests: outgoingRequests.map((request) => applyRequestPresence(request, presence)),
        isLoading: false,
        error: null,
        notice: tr("store.friendRequestAccepted")
      });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : tr("store.failedAcceptFriendRequest") });
      throw error;
    }
  },
  rejectFriendRequest: async (requestId) => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    const friendRequestId = requireNumericId(requestId, "Friend request id");
    set({ isLoading: true, error: null });
    try {
      await rejectBridgeFriendRequest(settings.bridgeHttpUrl, friendRequestId);
      const incoming = await listBridgeFriendRequests(settings.bridgeHttpUrl, true, 0);
      const incomingRequests = await hydrateRequests(settings.bridgeHttpUrl, incoming, currentUserId, "incoming");
      const presence = await loadPresence(settings.bridgeHttpUrl, incomingRequests.map((request) => request.peer.id));
      set({
        incomingRequests: incomingRequests.map((request) => applyRequestPresence(request, presence)),
        isLoading: false,
        error: null,
        notice: tr("store.friendRequestRejected")
      });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : tr("store.failedRejectFriendRequest") });
      throw error;
    }
  },
  deleteFriend: async (userId) => {
    const settings = useSettingsStore.getState();
    requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    const friendId = requireNumericId(userId, "Friend user_id");
    set({ isLoading: true, error: null });
    try {
      await deleteBridgeFriend(settings.bridgeHttpUrl, friendId);
      set((state) => ({
        isLoading: false,
        error: null,
        contacts: state.contacts.filter((contact) => contact.id !== userId)
      }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : tr("store.failedDeleteFriend") });
      throw error;
    }
  },
  clearNotice: () => set({ notice: null })
}));
