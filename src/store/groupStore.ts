import { create } from "zustand";
import type { Group } from "../types/group";
import type { User } from "../types/user";
import {
  createBridgeGroup,
  joinBridgeGroup,
  leaveBridgeGroup,
  listBridgeGroupMembers
} from "../api/bridgeApi";
import { useAuthStore } from "./authStore";
import { useSettingsStore } from "./settingsStore";

type GroupState = {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  loadGroupMembers: (groupId: string) => Promise<User[]>;
  createGroup: (name: string) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
};

function requireNumericId(value: string | undefined, label: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`${label} must be numeric.`);
  }
  return value;
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  isLoading: false,
  error: null,
  loadGroupMembers: async (groupId) => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      const numericGroupId = requireNumericId(groupId, "Group ID");
      const members = await listBridgeGroupMembers(settings.bridgeHttpUrl, numericGroupId);
      set((state) => ({
        isLoading: false,
        error: null,
        groups: state.groups.map((group) =>
          group.id === groupId ? { ...group, members, memberCount: members.length } : group
        )
      }));
      return members;
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to load group members." });
      throw error;
    }
  },
  createGroup: async (name) => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      const group = await createRealGroup(settings.bridgeHttpUrl, name);
      set((state) => ({ groups: [group, ...state.groups], isLoading: false, error: null }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to create group." });
      throw error;
    }
  },
  joinGroup: async (groupId) => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      const group = await joinRealGroup(settings.bridgeHttpUrl, groupId);
      set((state) => ({
        groups: state.groups.some((item) => item.id === group.id)
          ? state.groups.map((item) => (item.id === group.id ? { ...group } : item))
          : [group, ...state.groups],
        isLoading: false,
        error: null
      }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to join group." });
      throw error;
    }
  },
  leaveGroup: async (groupId) => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      const userId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
      const numericGroupId = requireNumericId(groupId, "Group ID");
      await leaveBridgeGroup(settings.bridgeHttpUrl, userId, numericGroupId);
      set((state) => ({
        groups: state.groups.map((item) =>
          item.id === groupId ? { ...item, memberCount: Math.max(0, item.memberCount - 1) } : item
        ),
        isLoading: false,
        error: null
      }));
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to leave group." });
      throw error;
    }
  }
}));

async function createRealGroup(baseUrl: string, name: string): Promise<Group> {
  const currentUser = useAuthStore.getState().user;
  const ownerId = requireNumericId(currentUser?.id, "Current user_id");
  const response = await createBridgeGroup(baseUrl, ownerId, name);
  return {
    id: response.groupId,
    name,
    ownerId,
    memberCount: currentUser ? 1 : 0,
    members: currentUser ? [currentUser] : [],
    createdAt: Date.now()
  };
}

async function joinRealGroup(baseUrl: string, groupId: string): Promise<Group> {
  const userId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
  const numericGroupId = requireNumericId(groupId.trim(), "Group ID");
  await joinBridgeGroup(baseUrl, userId, numericGroupId);
  const members = await listBridgeGroupMembers(baseUrl, numericGroupId);
  return {
    id: numericGroupId,
    name: `Group ${numericGroupId}`,
    ownerId: "",
    memberCount: members.length,
    members,
    createdAt: Date.now()
  };
}
