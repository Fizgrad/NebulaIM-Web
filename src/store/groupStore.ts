import { create } from "zustand";
import type { Group } from "../types/group";
import type { User } from "../types/user";
import {
  createBridgeGroup,
  getBridgePresence,
  getBridgeGroup,
  joinBridgeGroup,
  leaveBridgeGroup,
  listBridgeGroups,
  listBridgeGroupMembers,
  searchBridgeGroups
} from "../api/bridgeApi";
import { useAuthStore } from "./authStore";
import { useSettingsStore } from "./settingsStore";

type GroupState = {
  groups: Group[];
  groupSearchResults: Group[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;
  loadGroups: () => Promise<void>;
  loadGroupMembers: (groupId: string) => Promise<User[]>;
  searchGroups: (query: string) => Promise<Group[]>;
  clearGroupSearch: () => void;
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

function isNumericId(value: string | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value));
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

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  groupSearchResults: [],
  isLoading: false,
  isSearching: false,
  error: null,
  loadGroups: async () => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      const userId = requireNumericId(useAuthStore.getState().user?.id, "Current user_id");
      const groups = await listBridgeGroups(settings.bridgeHttpUrl, userId);
      set({ groups, isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to load groups." });
      throw error;
    }
  },
  loadGroupMembers: async (groupId) => {
    const settings = useSettingsStore.getState();
    set({ isLoading: true, error: null });
    try {
      const numericGroupId = requireNumericId(groupId, "Group ID");
      const members = await listBridgeGroupMembers(settings.bridgeHttpUrl, numericGroupId);
      const presence = await loadPresence(settings.bridgeHttpUrl, members.map((member) => member.id));
      const membersWithPresence = members.map((member) => applyPresence(member, presence));
      set((state) => ({
        isLoading: false,
        error: null,
        groups: state.groups.map((group) =>
          group.id === groupId ? { ...group, members: membersWithPresence, memberCount: membersWithPresence.length } : group
        )
      }));
      return membersWithPresence;
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : "Failed to load group members." });
      throw error;
    }
  },
  searchGroups: async (query) => {
    const settings = useSettingsStore.getState();
    const keyword = query.trim();
    if (!keyword) {
      set({ groupSearchResults: [], isSearching: false, error: null });
      return [];
    }
    set({ isSearching: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;
      const groups = await searchBridgeGroups(settings.bridgeHttpUrl, keyword, isNumericId(userId) ? userId : undefined);
      set({ groupSearchResults: groups, isSearching: false, error: null });
      return groups;
    } catch (error) {
      set({ isSearching: false, error: error instanceof Error ? error.message : "Failed to search groups." });
      throw error;
    }
  },
  clearGroupSearch: () => set({ groupSearchResults: [], isSearching: false, error: null }),
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
        groups: state.groups.filter((item) => item.id !== groupId),
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
  const [members, groupInfo] = await Promise.all([
    listBridgeGroupMembers(baseUrl, numericGroupId),
    getBridgeGroup(baseUrl, numericGroupId).catch(() => null)
  ]);
  return {
    id: numericGroupId,
    name: groupInfo?.name ?? `Group ${numericGroupId}`,
    ownerId: groupInfo?.ownerId ?? "",
    memberCount: groupInfo?.memberCount ?? members.length,
    members,
    createdAt: groupInfo?.createdAt ?? Date.now()
  };
}
