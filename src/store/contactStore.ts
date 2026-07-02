import { create } from "zustand";
import type { BridgeFriendRequest } from "../api/bridgeApi";
import type { User } from "../types/user";
import {
  acceptBridgeFriendRequest,
  deleteBridgeFriend,
  getBridgeUserByUsername,
  getBridgeUserInfo,
  listBridgeFriendRequests,
  listBridgeFriends,
  rejectBridgeFriendRequest,
  sendBridgeFriendRequest
} from "../api/bridgeApi";
import { useAuthStore } from "./authStore";
import { useSettingsStore } from "./settingsStore";

export type FriendRequestView = BridgeFriendRequest & {
  direction: "incoming" | "outgoing";
  peer: User;
};

type ContactState = {
  contacts: User[];
  incomingRequests: FriendRequestView[];
  outgoingRequests: FriendRequestView[];
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  loadFriends: () => Promise<void>;
  sendFriendRequest: (identifier: string, message?: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  deleteFriend: (userId: string) => Promise<void>;
  clearNotice: () => void;
};

function requireNumericId(value: string | undefined, label: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be numeric.`);
  }
  return value;
}

async function resolveFriendUserId(baseUrl: string, identifier: string) {
  const value = identifier.trim();
  if (!value) {
    throw new Error("Friend username or user_id is required.");
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
    username: `user_${userId}`,
    nickname: `User ${userId}`,
    avatarColor: "from-cyan-500 to-blue-500",
    status: "offline",
    registeredAt: Date.now(),
    gateway: "RelationService",
    connectionId: `user-${userId}`
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
  error: null,
  notice: null,
  loadFriends: async () => {
    const settings = useSettingsStore.getState();
    const userId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    set({ isLoading: true, error: null });
    try {
      const [contacts, incoming, outgoing] = await Promise.all([
        listBridgeFriends(settings.bridgeHttpUrl, userId),
        listBridgeFriendRequests(settings.bridgeHttpUrl, userId, true, 0),
        listBridgeFriendRequests(settings.bridgeHttpUrl, userId, false, 0)
      ]);
      const [incomingRequests, outgoingRequests] = await Promise.all([
        hydrateRequests(settings.bridgeHttpUrl, incoming, userId, "incoming"),
        hydrateRequests(settings.bridgeHttpUrl, outgoing, userId, "outgoing")
      ]);
      set({ contacts, incomingRequests, outgoingRequests, isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to load friends." });
    }
  },
  sendFriendRequest: async (identifier, message = "") => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    set({ isLoading: true, error: null });
    try {
      const toUserId = await resolveFriendUserId(settings.bridgeHttpUrl, identifier);
      if (toUserId === currentUserId) {
        throw new Error("You cannot send a friend request to yourself.");
      }
      await sendBridgeFriendRequest(settings.bridgeHttpUrl, currentUserId, toUserId, message.trim());
      const [incoming, outgoing] = await Promise.all([
        listBridgeFriendRequests(settings.bridgeHttpUrl, currentUserId, true, 0),
        listBridgeFriendRequests(settings.bridgeHttpUrl, currentUserId, false, 0)
      ]);
      const [incomingRequests, outgoingRequests] = await Promise.all([
        hydrateRequests(settings.bridgeHttpUrl, incoming, currentUserId, "incoming"),
        hydrateRequests(settings.bridgeHttpUrl, outgoing, currentUserId, "outgoing")
      ]);
      set({
        incomingRequests,
        outgoingRequests,
        isLoading: false,
        error: null,
        notice: "Friend request sent."
      });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to send friend request." });
      throw error;
    }
  },
  acceptFriendRequest: async (requestId) => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    const friendRequestId = requireNumericId(requestId, "Friend request id");
    set({ isLoading: true, error: null });
    try {
      await acceptBridgeFriendRequest(settings.bridgeHttpUrl, currentUserId, friendRequestId);
      const [contacts, incoming, outgoing] = await Promise.all([
        listBridgeFriends(settings.bridgeHttpUrl, currentUserId),
        listBridgeFriendRequests(settings.bridgeHttpUrl, currentUserId, true, 0),
        listBridgeFriendRequests(settings.bridgeHttpUrl, currentUserId, false, 0)
      ]);
      const [incomingRequests, outgoingRequests] = await Promise.all([
        hydrateRequests(settings.bridgeHttpUrl, incoming, currentUserId, "incoming"),
        hydrateRequests(settings.bridgeHttpUrl, outgoing, currentUserId, "outgoing")
      ]);
      set({ contacts, incomingRequests, outgoingRequests, isLoading: false, error: null, notice: "Friend request accepted." });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to accept friend request." });
      throw error;
    }
  },
  rejectFriendRequest: async (requestId) => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    const friendRequestId = requireNumericId(requestId, "Friend request id");
    set({ isLoading: true, error: null });
    try {
      await rejectBridgeFriendRequest(settings.bridgeHttpUrl, currentUserId, friendRequestId);
      const incoming = await listBridgeFriendRequests(settings.bridgeHttpUrl, currentUserId, true, 0);
      const incomingRequests = await hydrateRequests(settings.bridgeHttpUrl, incoming, currentUserId, "incoming");
      set({ incomingRequests, isLoading: false, error: null, notice: "Friend request rejected." });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to reject friend request." });
      throw error;
    }
  },
  deleteFriend: async (userId) => {
    const settings = useSettingsStore.getState();
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    const friendId = requireNumericId(userId, "Friend user_id");
    set({ isLoading: true, error: null });
    try {
      await deleteBridgeFriend(settings.bridgeHttpUrl, currentUserId, friendId);
      set((state) => ({
        isLoading: false,
        error: null,
        contacts: state.contacts.filter((contact) => contact.id !== userId)
      }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to delete friend." });
      throw error;
    }
  },
  clearNotice: () => set({ notice: null })
}));
