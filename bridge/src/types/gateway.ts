import type { MessageType } from "../gateway/MessageType.js";
import type { Packet } from "../gateway/Packet.js";

export type TcpGatewayClientOptions = {
  host: string;
  port: number;
  timeoutMs: number;
  sessionId: string;
};

export type PendingRequest = {
  type: MessageType;
  responseType: MessageType;
  resolve: (packet: Packet) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  startedAt: number;
};
