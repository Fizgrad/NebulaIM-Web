export type ClientEventType =
  | "auth.login"
  | "connection.heartbeat"
  | "message.send_single"
  | "message.send_group"
  | "message.ack"
  | "message.pull_offline";

export type ClientEvent<TPayload = unknown> = {
  id: string;
  type: ClientEventType;
  timestamp: number;
  traceId: string;
  payload: TPayload;
};

export type ServerEvent<TPayload = unknown> = {
  id: string;
  type: string;
  ok: boolean;
  timestamp: number;
  payload?: TPayload;
  error?: {
    code: number;
    message: string;
  };
};

export type BridgeHealth = {
  ok: boolean;
  service: string;
};

export type BridgeInfo = {
  name: string;
  gateway: string;
  user?: string;
  relation?: string;
  admin?: string;
  websocket: string;
};
