import type { Message, SendMessagePayload } from "./message";

export type ConnectionMode = "mock" | "real";
export type GatewayTransport = "direct" | "bridge";

export type GatewayConnectionState = "connected" | "disconnected" | "reconnecting";

export type GatewayStatus = {
  state: GatewayConnectionState;
  heartbeatOk: boolean;
  latency: number;
  connectedAt?: number;
  lastHeartbeatAt?: number;
  mode: ConnectionMode;
  transport?: GatewayTransport;
  bridgeUrl?: string;
  error?: string;
};

export type RegisterResult = {
  userId: string;
  username?: string;
  nickname?: string;
};

export type LoginResult = {
  userId: string;
  username?: string;
  nickname?: string;
  token: string;
  expireAt?: number;
};

export type SendSingleMessagePayload = SendMessagePayload & {
  fromUserId: string;
  toUserId: string;
  clientSequenceId: number;
};

export type SendGroupMessagePayload = SendMessagePayload & {
  fromUserId: string;
  groupId: string;
  clientSequenceId: number;
};

export type SendMessageResult = {
  messageId: string;
  status: "sent";
  serverTimestamp: number;
};

export type MessageHandler = (message: Message) => void;
export type StatusHandler = (status: GatewayStatus) => void;

export interface GatewayClient {
  connect(): Promise<void>;
  disconnect(): void;
  register(username: string, password: string, nickname: string): Promise<RegisterResult>;
  login(username: string, password: string): Promise<LoginResult>;
  sendSingleMessage(payload: SendSingleMessagePayload): Promise<SendMessageResult>;
  sendGroupMessage(payload: SendGroupMessagePayload): Promise<SendMessageResult>;
  ackMessage(messageId: string, userId?: string): Promise<void>;
  pullOfflineMessages(userId?: string): Promise<Message[]>;
  sendHeartbeat(): void;
  onMessage(handler: MessageHandler): void;
  onStatusChange(handler: StatusHandler): void;
}
