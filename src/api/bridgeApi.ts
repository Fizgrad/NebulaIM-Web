import axios from "axios";
import type { BridgeHealth, BridgeInfo } from "../types/bridge";
import { ApiError, httpClient, requestWithRetry } from "./client";

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
