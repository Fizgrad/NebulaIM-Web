import type WebSocket from "ws";
import type { TcpGatewayClient } from "../gateway/TcpGatewayClient.js";
import type { ProtoRegistry } from "../proto/loadProto.js";

export type ServerEvent = {
  id: string;
  type: string;
  ok: boolean;
  timestamp: number;
  payload?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

export type BridgeSession = {
  id: string;
  ws: WebSocket;
  gateway: TcpGatewayClient;
  proto: ProtoRegistry;
  userId?: string;
  token?: string;
  connectedAt: number;
  lastHeartbeatAt?: number;
  send: (event: ServerEvent) => void;
};

export type LoginResponsePayload = {
  ok: boolean;
  code: number;
  message: string;
  userId: string;
  token: string;
  expireAt: string;
  nickname: string;
};

export type CommonResponsePayload = {
  ok: boolean;
  code: number;
  message: string;
  requestId?: string;
};

export type SendMessageResponsePayload = {
  ok: boolean;
  code: number;
  message: string;
  messageId: string;
  serverTimestamp: string;
};

export type AckMessageResponsePayload = {
  ok: boolean;
  code: number;
  message: string;
  messageId: string;
};

export type MessageDataPayload = {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toUserId?: string;
  groupId?: string;
  content: string;
  contentType: "text";
  serverTimestamp: string;
};

export type PullOfflineMessagesResponsePayload = {
  ok: boolean;
  code: number;
  message: string;
  messages: MessageDataPayload[];
};
