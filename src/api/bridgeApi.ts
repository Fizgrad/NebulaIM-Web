import axios from "axios";
import type { BridgeHealth, BridgeInfo } from "../types/bridge";
import { ApiError, httpClient, requestWithRetry } from "./client";
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

type CreateBridgeGroupResponse = {
  ok: boolean;
  groupId: string;
  response: CommonBridgeResponse;
};

type ListBridgeGroupMembersResponse = {
  ok: boolean;
  members: RelationUserInfo[];
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
    status: "online",
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

function toUser(user: RelationUserInfo): User {
  return {
    id: user.userId,
    username: user.username,
    nickname: user.nickname || user.username || `User ${user.userId}`,
    avatar: user.avatar || undefined,
    avatarColor: "from-cyan-500 to-blue-500",
    status: "online",
    registeredAt: Number(user.createdAt ?? Date.now()),
    gateway: "RelationService",
    connectionId: `user-${user.userId}`
  };
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
