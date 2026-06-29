import { create } from "zustand";
import type { User } from "../types/user";
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

function requireNumericId(value: string | undefined, label: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be numeric.`);
  }
  return value;
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [],
  isLoading: false,
  error: null,
  loadFriends: async () => {
    const settings = useSettingsStore.getState();
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
    const friendId = requireNumericId(userId.trim(), "Friend user_id");
    const currentUserId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
    set({ isLoading: true, error: null });
    try {
      await addBridgeFriend(settings.bridgeHttpUrl, currentUserId, friendId);
      const user = await getBridgeUserInfo(settings.bridgeHttpUrl, friendId);
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
  }
}));
