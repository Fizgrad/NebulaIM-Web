import type { Group } from "../types/group";
import { currentUser, mockUsers } from "./users";

const [operator, alice, bob, charlie, diana] = mockUsers;
const now = Date.now();

export const mockGroups: Group[] = [
  {
    id: "g-core",
    name: "Nebula Core Team",
    ownerId: currentUser.id,
    memberCount: 4,
    members: [operator, alice, bob, diana],
    createdAt: now - 1000 * 60 * 60 * 24 * 120
  },
  {
    id: "g-infra",
    name: "Backend Infra Group",
    ownerId: alice.id,
    memberCount: 5,
    members: [operator, alice, bob, charlie, diana],
    createdAt: now - 1000 * 60 * 60 * 24 * 64
  }
];
