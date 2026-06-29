import { create } from "zustand";
import type { User } from "../types/user";
import { mockUsers, currentUser } from "../mocks/users";
import * as relationApi from "../api/relationApi";
import { addBridgeFriend, deleteBridgeFriend, getBridgeUserInfo, listBridgeFriends } from "../api/bridgeApi";
import { useAuthStore } from "./authStore";
import { useSettingsStore } from "./settingsStore";

type ContactState = {
  contacts: User[];
  isLoading: boolean;
  error: string | null;
  loadFriends: () => Promise<void>;
  addFriend: (userId: string) => Promise<void>;
  deleteFriend: (userId: string) => Promise<void>;
};

function exampleContacts() {
  return mockUsers.filter((user) => user.id !== currentUser.id);
}

function initialContacts() {
  return useSettingsStore.getState().connectionMode === "mock" ? exampleContacts() : [];
}

function requireNumericId(value: string | undefined, label: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be numeric in Real Bridge mode.`);
  }
  return value;
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: initialContacts(),
  isLoading: false,
  error: null,
  loadFriends: async () => {
    const settings = useSettingsStore.getState();
    if (settings.connectionMode === "mock") {
      const contacts = await relationApi.listFriends();
      set({ contacts, error: null });
      return;
    }

    const userId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    set({ isLoading: true, error: null });
    try {
      const contacts = await listBridgeFriends(settings.bridgeHttpUrl, userId);
      set({ contacts, isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to load friends." });
    }
  },
  addFriend: async (userId) => {
    const settings = useSettingsStore.getState();
    const friendId = userId.trim();
    set({ isLoading: true, error: null });
    try {
      const user =
        settings.connectionMode === "real"
          ? await addRealFriend(settings.bridgeHttpUrl, friendId)
          : await relationApi.addFriend(friendId);
      set((state) => ({
        isLoading: false,
        error: null,
        contacts: state.contacts.some((contact) => contact.id === user.id) ? state.contacts : [user, ...state.contacts]
      }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to add friend." });
      throw error;
    }
  },
  deleteFriend: async (userId) => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      if (settings.connectionMode === "real") {
        const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
        const friendId = requireNumericId(userId, "Friend user_id");
        await deleteBridgeFriend(settings.bridgeHttpUrl, currentUserId, friendId);
      } else {
        await relationApi.deleteFriend(userId);
      }
      set((state) => ({
        isLoading: false,
        error: null,
        contacts: state.contacts.filter((contact) => contact.id !== userId)
      }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to delete friend." });
      throw error;
    }
  }
}));

async function addRealFriend(baseUrl: string, friendId: string) {
  const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
  const numericFriendId = requireNumericId(friendId, "Friend user_id");
  await addBridgeFriend(baseUrl, currentUserId, numericFriendId);
  return getBridgeUserInfo(baseUrl, numericFriendId);
}
