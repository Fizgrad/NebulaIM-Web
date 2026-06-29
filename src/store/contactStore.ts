import { create } from "zustand";
import type { User } from "../types/user";
import { mockUsers, currentUser } from "../mocks/users";
import * as relationApi from "../api/relationApi";

type ContactState = {
  contacts: User[];
  isLoading: boolean;
  addFriend: (userId: string) => Promise<void>;
  deleteFriend: (userId: string) => Promise<void>;
};

export const useContactStore = create<ContactState>((set) => ({
  contacts: mockUsers.filter((user) => user.id !== currentUser.id),
  isLoading: false,
  addFriend: async (userId) => {
    set({ isLoading: true });
    const user = await relationApi.addFriend(userId);
    set((state) => ({
      isLoading: false,
      contacts: state.contacts.some((contact) => contact.id === user.id) ? state.contacts : [user, ...state.contacts]
    }));
  },
  deleteFriend: async (userId) => {
    set({ isLoading: true });
    await relationApi.deleteFriend(userId);
    set((state) => ({
      isLoading: false,
      contacts: state.contacts.filter((contact) => contact.id !== userId)
    }));
  }
}));
