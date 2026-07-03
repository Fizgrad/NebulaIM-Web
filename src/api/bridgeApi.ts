import axios from "axios";
import type { BridgeHealth, BridgeInfo } from "../types/bridge";
import { ApiError, httpClient, requestWithRetry } from "./client";
import type { Group } from "../types/group";
import type { User } from "../types/user";

type BridgeErrorResponse = {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

type RegisterBridgeResponse = {
  ok: boolean;
  userId: string;
  username: string;
  nickname: string;
};

type RefreshBridgeResponse = {
  ok: boolean;
  userId: string;
  token: string;
  expireAt: number | string;
};

type BridgeUserInfo = {
  userId: string;
  username: string;
  nickname: string;
  avatar?: string;
  createdAt?: number | string;
};

type GetBridgeUserResponse = {
  ok: boolean;
  user: BridgeUserInfo;
};

type RelationUserInfo = BridgeUserInfo;

type BridgePresenceInfo = {
  userId: string;
  online: boolean;
  gatewayId?: string;
  connectionId?: string;
};

type GetBridgePresenceResponse = {
  ok: boolean;
  users: BridgePresenceInfo[];
};

export type BridgeFriendRequestStatus = 0 | 1 | 2 | 3;

export type BridgeFriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: BridgeFriendRequestStatus;
  createdAt: number;
  updatedAt: number;
};

type CommonBridgeResponse = {
  code: number;
  message: string;
  requestId?: string;
};

type ListBridgeFriendsResponse = {
  ok: boolean;
  friends: RelationUserInfo[];
};

type CommonRelationResponse = {
  ok: boolean;
  response: CommonBridgeResponse;
};

type SendBridgeMessageResponse = {
  ok: boolean;
  messageId: string;
  serverTimestamp: number | string;
  response: CommonBridgeResponse;
};

export type BridgeMessageInfo = {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  groupId: string;
  contentType: number;
  content: string;
  status: number;
  recalled: boolean;
  recalledAt: string | number;
  createdAt: string | number;
};

type ListBridgeMessagesResponse = {
  ok: boolean;
  messages: BridgeMessageInfo[];
};

type RawFriendRequest = {
  friendRequestId: string;
  fromUserId: string;
  toUserId: string;
  message?: string;
  status: number;
  createdAt?: number | string;
  updatedAt?: number | string;
};

type SendFriendRequestResponse = {
  ok: boolean;
  friendRequestId: string;
  response: CommonBridgeResponse;
};

type ListFriendRequestsResponse = {
  ok: boolean;
  requests: RawFriendRequest[];
};

type CreateBridgeGroupResponse = {
  ok: boolean;
  groupId: string;
  response: CommonBridgeResponse;
};

type BridgeGroupInfo = {
  groupId: string;
  name: string;
  ownerId: string;
  memberCount: number;
  createdAt: number | string;
  updatedAt?: number | string;
};

type GetBridgeGroupResponse = {
  ok: boolean;
  group: BridgeGroupInfo;
};

type ListBridgeGroupsResponse = {
  ok: boolean;
  groups: BridgeGroupInfo[];
};

type ListBridgeGroupMembersResponse = {
  ok: boolean;
  members: RelationUserInfo[];
};

type BridgeConversationInfo = {
  conversationId: string;
  conversationType: number;
  ownerUserId: string;
  peerUserId: string;
  groupId: string;
  groupName?: string;
  lastMessageId: string;
  lastMessagePreview: string;
  lastMessageAt: string | number;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  deleted: boolean;
  updatedAt: string | number;
};

type ListBridgeConversationsResponse = {
  ok: boolean;
  conversations: BridgeConversationInfo[];
};

export async function getBridgeHealth(baseUrl: string) {
  const response = await requestWithRetry(() => httpClient.get<BridgeHealth>(`${baseUrl.replace(/\/$/, "")}/health`), { retries: 1 });
  return response.data;
}

export async function getBridgeInfo(baseUrl: string) {
  const response = await requestWithRetry(() => httpClient.get<BridgeInfo>(`${baseUrl.replace(/\/$/, "")}/info`), { retries: 1 });
  return response.data;
}

export async function testBridgeConnection(baseUrl: string) {
  const [health, info] = await Promise.all([getBridgeHealth(baseUrl), getBridgeInfo(baseUrl)]);
  return { health, info };
}

export async function refreshBridgeToken(baseUrl: string, token: string) {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<RefreshBridgeResponse>(`${baseUrl.replace(/\/$/, "")}/api/auth/refresh`, {
          token
        }),
      { retries: 1 }
    )
  );
  return {
    token: response.token,
    expireAt: response.expireAt
  };
}

export async function registerBridgeUser(baseUrl: string, username: string, password: string, nickname: string) {
  return bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<RegisterBridgeResponse>(`${baseUrl.replace(/\/$/, "")}/api/auth/register`, {
          username,
          password,
          nickname
        }),
      { retries: 1 }
    )
  );
}

export async function getBridgeUserInfo(baseUrl: string, userId: string): Promise<User> {
  const response = await bridgeRequest(() =>
    requestWithRetry(() => httpClient.get<GetBridgeUserResponse>(`${baseUrl.replace(/\/$/, "")}/api/auth/users/${userId}`), {
      retries: 1
    })
  );
  const user = response.user;
  return {
    id: user.userId,
    username: user.username,
    nickname: user.nickname || user.username || `User ${user.userId}`,
    avatar: user.avatar || undefined,
    avatarColor: "from-cyan-500 to-blue-500",
    status: "offline",
    registeredAt: Number(user.createdAt ?? Date.now()),
    gateway: "UserService",
    connectionId: `user-${user.userId}`
  };
}

export async function getBridgeUserByUsername(baseUrl: string, username: string): Promise<User> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () => httpClient.get<GetBridgeUserResponse>(`${baseUrl.replace(/\/$/, "")}/api/auth/users/by-username/${encodeURIComponent(username)}`),
      { retries: 1 }
    )
  );
  const user = response.user;
  return {
    id: user.userId,
    username: user.username,
    nickname: user.nickname || user.username || `User ${user.userId}`,
    avatar: user.avatar || undefined,
    avatarColor: "from-cyan-500 to-blue-500",
    status: "offline",
    registeredAt: Number(user.createdAt ?? Date.now()),
    gateway: "UserService",
    connectionId: `user-${user.userId}`
  };
}

export async function listBridgeFriends(baseUrl: string, userId: string): Promise<User[]> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () => httpClient.get<ListBridgeFriendsResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/friends`, { params: { userId } }),
      { retries: 1 }
    )
  );
  return response.friends.map(toUser);
}

export async function getBridgePresence(baseUrl: string, userIds: string[]): Promise<Record<string, boolean>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter((userId) => /^\d+$/.test(userId))));
  if (uniqueUserIds.length === 0) return {};
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.get<GetBridgePresenceResponse>(`${baseUrl.replace(/\/$/, "")}/api/presence/users`, {
          params: { userIds: uniqueUserIds.join(",") }
        }),
      { retries: 1 }
    )
  );
  return Object.fromEntries((response.users ?? []).map((user) => [user.userId, Boolean(user.online)]));
}

export async function addBridgeFriend(baseUrl: string, userId: string, friendId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<CommonRelationResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/friends`, {
          userId,
          friendId
        }),
      { retries: 1 }
    )
  );
}

export async function sendBridgeFriendRequest(baseUrl: string, fromUserId: string, toUserId: string, message = "") {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<SendFriendRequestResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/friend-requests`, {
          fromUserId,
          toUserId,
          message
        }),
      { retries: 1 }
    )
  );
  return {
    friendRequestId: response.friendRequestId,
    response: response.response
  };
}

export async function listBridgeFriendRequests(
  baseUrl: string,
  userId: string,
  incoming: boolean,
  status: BridgeFriendRequestStatus = 0
): Promise<BridgeFriendRequest[]> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.get<ListFriendRequestsResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/friend-requests`, {
          params: { userId, incoming, status }
        }),
      { retries: 1 }
    )
  );
  return (response.requests ?? []).map(toFriendRequest);
}

export async function acceptBridgeFriendRequest(baseUrl: string, userId: string, friendRequestId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<CommonRelationResponse>(
          `${baseUrl.replace(/\/$/, "")}/api/relation/friend-requests/${friendRequestId}/accept`,
          { userId }
        ),
      { retries: 1 }
    )
  );
}

export async function rejectBridgeFriendRequest(baseUrl: string, userId: string, friendRequestId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<CommonRelationResponse>(
          `${baseUrl.replace(/\/$/, "")}/api/relation/friend-requests/${friendRequestId}/reject`,
          { userId }
        ),
      { retries: 1 }
    )
  );
}

export async function deleteBridgeFriend(baseUrl: string, userId: string, friendId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.delete<CommonRelationResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/friends/${friendId}`, {
          params: { userId }
        }),
      { retries: 1 }
    )
  );
}

export async function createBridgeGroup(baseUrl: string, ownerId: string, name: string) {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<CreateBridgeGroupResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups`, {
          ownerId,
          name
        }),
      { retries: 1 }
    )
  );
  return {
    groupId: response.groupId,
    response: response.response
  };
}

export async function getBridgeGroup(baseUrl: string, groupId: string): Promise<Group> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () => httpClient.get<GetBridgeGroupResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups/${groupId}`),
      { retries: 1 }
    )
  );
  return toGroup(response.group);
}

export async function listBridgeGroups(baseUrl: string, userId: string): Promise<Group[]> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.get<ListBridgeGroupsResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups`, {
          params: { userId }
        }),
      { retries: 1 }
    )
  );
  return (response.groups ?? []).map(toGroup);
}

export async function searchBridgeGroups(baseUrl: string, query: string, userId?: string): Promise<Group[]> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.get<ListBridgeGroupsResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups/search`, {
          params: { q: query, userId }
        }),
      { retries: 1 }
    )
  );
  return (response.groups ?? []).map(toGroup);
}

export async function joinBridgeGroup(baseUrl: string, userId: string, groupId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () => httpClient.post<CommonRelationResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups/${groupId}/join`, { userId }),
      { retries: 1 }
    )
  );
}

export async function leaveBridgeGroup(baseUrl: string, userId: string, groupId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () => httpClient.post<CommonRelationResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups/${groupId}/leave`, { userId }),
      { retries: 1 }
    )
  );
}

export async function listBridgeGroupMembers(baseUrl: string, groupId: string): Promise<User[]> {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () => httpClient.get<ListBridgeGroupMembersResponse>(`${baseUrl.replace(/\/$/, "")}/api/relation/groups/${groupId}/members`),
      { retries: 1 }
    )
  );
  return response.members.map(toUser);
}

export async function listBridgeConversations(baseUrl: string, userId: string, page = 1, pageSize = 50) {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.get<ListBridgeConversationsResponse>(`${baseUrl.replace(/\/$/, "")}/api/conversations`, {
          params: { userId, page, pageSize }
        }),
      { retries: 1 }
    )
  );
  return response.conversations ?? [];
}

export async function markBridgeConversationRead(baseUrl: string, userId: string, conversationId: string): Promise<void> {
  await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post(`${baseUrl.replace(/\/$/, "")}/api/conversations/${conversationId}/read`, {
          userId
        }),
      { retries: 1 }
    )
  );
}

export async function listBridgeConversationMessages(
  baseUrl: string,
  userId: string,
  conversationId: string,
  before = Date.now(),
  limit = 50
) {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.get<ListBridgeMessagesResponse>(`${baseUrl.replace(/\/$/, "")}/api/messages/conversations/${conversationId}`, {
          params: { userId, before, limit }
        }),
      { retries: 1 }
    )
  );
  return response.messages ?? [];
}

export async function sendBridgeSingleMessage(
  baseUrl: string,
  fromUserId: string,
  toUserId: string,
  content: string,
  clientSequenceId: number
) {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<SendBridgeMessageResponse>(`${baseUrl.replace(/\/$/, "")}/api/messages/single`, {
          fromUserId,
          toUserId,
          content,
          clientSequenceId
        }),
      { retries: 1 }
    )
  );
  return {
    messageId: response.messageId,
    serverTimestamp: Number(response.serverTimestamp || Date.now()),
    response: response.response
  };
}

export async function sendBridgeGroupMessage(
  baseUrl: string,
  fromUserId: string,
  groupId: string,
  content: string,
  clientSequenceId: number
) {
  const response = await bridgeRequest(() =>
    requestWithRetry(
      () =>
        httpClient.post<SendBridgeMessageResponse>(`${baseUrl.replace(/\/$/, "")}/api/messages/group`, {
          fromUserId,
          groupId,
          content,
          clientSequenceId
        }),
      { retries: 1 }
    )
  );
  return {
    messageId: response.messageId,
    serverTimestamp: Number(response.serverTimestamp || Date.now()),
    response: response.response
  };
}

function toUser(user: RelationUserInfo): User {
  return {
    id: user.userId,
    username: user.username,
    nickname: user.nickname || user.username || `User ${user.userId}`,
    avatar: user.avatar || undefined,
    avatarColor: "from-cyan-500 to-blue-500",
    status: "offline",
    registeredAt: Number(user.createdAt ?? Date.now()),
    gateway: "RelationService",
    connectionId: `user-${user.userId}`
  };
}

function toGroup(group: BridgeGroupInfo): Group {
  return {
    id: group.groupId,
    name: group.name || `Group ${group.groupId}`,
    ownerId: group.ownerId,
    memberCount: Number(group.memberCount ?? 0),
    members: [],
    createdAt: Number(group.createdAt ?? Date.now())
  };
}

function toFriendRequest(request: RawFriendRequest): BridgeFriendRequest {
  return {
    id: request.friendRequestId,
    fromUserId: request.fromUserId,
    toUserId: request.toUserId,
    message: request.message ?? "",
    status: normalizeFriendRequestStatus(request.status),
    createdAt: Number(request.createdAt ?? Date.now()),
    updatedAt: Number(request.updatedAt ?? request.createdAt ?? Date.now())
  };
}

function normalizeFriendRequestStatus(status: number): BridgeFriendRequestStatus {
  return status === 1 || status === 2 || status === 3 ? status : 0;
}

async function bridgeRequest<T>(operation: () => Promise<{ data: T }>) {
  try {
    const response = await operation();
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as BridgeErrorResponse | undefined;
      if (data?.error?.message) {
        throw new ApiError(
          {
            code: data.error.code ?? "BRIDGE_ERROR",
            message: data.error.message
          },
          error.response?.status ?? 400
        );
      }
    }
    throw error;
  }
}
