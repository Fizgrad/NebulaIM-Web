import type { BridgeHealth, BridgeInfo } from "../types/bridge";
import { httpClient, requestWithRetry } from "./client";

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
  const response = await requestWithRetry(
    () =>
      httpClient.post<{ token: string; expireAt: number | string }>(`${baseUrl.replace(/\/$/, "")}/api/auth/refresh`, {
        token
      }),
    { retries: 1 }
  );
  return response.data;
}
