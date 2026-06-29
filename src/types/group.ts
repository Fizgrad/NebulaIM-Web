import type { User } from "./user";

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  members: User[];
  createdAt: number;
};
