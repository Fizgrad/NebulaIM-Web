import type { Group } from "../types/group";
import type { User } from "../types/user";
import { mockGroups } from "../mocks/groups";
import { currentUser, mockUsers } from "../mocks/users";
import { createId } from "../utils/id";
import { ApiError, mockRequest } from "./client";

const friends = mockUsers.filter((user) => user.id !== currentUser.id);
const groups = [...mockGroups];

export async function listFriends() {
  return mockRequest<User[]>(() => friends);
}

export async function addFriend(userId: string) {
  return mockRequest<User>(() => {
    const existing = friends.find((user) => user.id === userId || user.username === userId);
    if (existing) return existing;

    const user: User = {
      id: /^\d+$/.test(userId.trim()) ? userId.trim() : createId("u"),
      username: userId.trim() || "new_friend",
      nickname: userId.trim() || "New Friend",
      avatarColor: "from-blue-400 to-cyan-400",
      status: "online",
      registeredAt: Date.now(),
      gateway: "gateway-mock-01:9000",
      connectionId: createId("conn")
    };
    friends.unshift(user);
    return user;
  });
}

export async function deleteFriend(userId: string) {
  return mockRequest<{ userId: string; deleted: true }>(() => {
    const index = friends.findIndex((user) => user.id === userId);
    if (index >= 0) friends.splice(index, 1);
    return { userId, deleted: true };
  });
}

export async function listGroups() {
  return mockRequest<Group[]>(() => groups);
}

export async function createGroup(name: string) {
  return mockRequest<Group>(() => {
    if (!name.trim()) {
      throw new ApiError({ code: "VALIDATION_ERROR", message: "Group name is required." }, 422);
    }
    const group: Group = {
      id: createId("g"),
      name: name.trim(),
      ownerId: currentUser.id,
      memberCount: 1,
      members: [currentUser],
      createdAt: Date.now()
    };
    groups.unshift(group);
    return group;
  });
}

export async function joinGroup(groupId: string) {
  return mockRequest<Group>(() => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) throw new ApiError({ code: "NOT_FOUND", message: "Group not found." }, 404);
    if (!group.members.some((member) => member.id === currentUser.id)) {
      group.members.push(currentUser);
      group.memberCount = group.members.length;
    }
    return group;
  });
}

export async function leaveGroup(groupId: string) {
  return mockRequest<{ groupId: string; left: true }>(() => {
    const group = groups.find((item) => item.id === groupId);
    if (group) {
      group.members = group.members.filter((member) => member.id !== currentUser.id);
      group.memberCount = group.members.length;
    }
    return { groupId, left: true };
  });
}

export async function listGroupMembers(groupId: string) {
  return mockRequest<User[]>(() => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) throw new ApiError({ code: "NOT_FOUND", message: "Group not found." }, 404);
    return group.members;
  });
}
