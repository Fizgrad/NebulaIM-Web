import { create } from "zustand";
import type { Group } from "../types/group";
import { mockGroups } from "../mocks/groups";
import * as relationApi from "../api/relationApi";

type GroupState = {
  groups: Group[];
  isLoading: boolean;
  createGroup: (name: string) => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
};

export const useGroupStore = create<GroupState>((set) => ({
  groups: mockGroups.map((group) => ({ ...group })),
  isLoading: false,
  createGroup: async (name) => {
    set({ isLoading: true });
    const group = await relationApi.createGroup(name);
    set((state) => ({ groups: [group, ...state.groups], isLoading: false }));
  },
  joinGroup: async (groupId) => {
    set({ isLoading: true });
    const group = await relationApi.joinGroup(groupId);
    set((state) => ({
      groups: state.groups.map((item) => (item.id === groupId ? { ...group } : item)),
      isLoading: false
    }));
  },
  leaveGroup: async (groupId) => {
    set({ isLoading: true });
    await relationApi.leaveGroup(groupId);
    set((state) => ({
      groups: state.groups.map((item) =>
        item.id === groupId ? { ...item, memberCount: Math.max(0, item.memberCount - 1) } : item
      ),
      isLoading: false
    }));
  }
}));
