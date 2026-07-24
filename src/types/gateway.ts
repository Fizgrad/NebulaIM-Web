import type { Message } from "./message";

export type GatewayConnectionState = "connected" | "disconnected" | "reconnecting";

export type GatewayStatus = {
  state: GatewayConnectionState;
  heartbeatOk: boolean;
  latency: number;
  connectedAt?: number;
  lastHeartbeatAt?: number;
  gatewayUrl?: string;
  error?: string;
  sessionExpired?: boolean;
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

export type MessageHandler = (message: Message) => void;
export type StatusHandler = (status: GatewayStatus) => void;

export interface GatewayClient {
  setSession(token: string, userId: string): void;
  connect(): Promise<void>;
  disconnect(): void;
  register(username: string, password: string, nickname: string): Promise<RegisterResult>;
  login(username: string, password: string): Promise<LoginResult>;
  ackMessage(messageId: string, userId?: string): Promise<void>;
  sendHeartbeat(): void;
  onMessage(handler: MessageHandler): void;
  onStatusChange(handler: StatusHandler): void;
}
