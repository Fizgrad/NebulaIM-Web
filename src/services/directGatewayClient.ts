import type {
  GatewayClient,
  GatewayStatus,
  LoginResult,
  MessageHandler,
  RegisterResult,
  StatusHandler
} from "../types/gateway";
import type { Message, MessageContentType } from "../types/message";
import { BrowserPacketCodec } from "./browserPacketCodec";
import { decodeProto, encodeProto } from "./browserProtoRegistry";
import { clientLogger } from "./clientLogger";
import { currentDeviceId } from "./deviceIdentity";

const MessageType = {
  LOGIN_REQ: 1001,
  LOGIN_RESP: 1002,
  REGISTER_REQ: 1003,
  REGISTER_RESP: 1004,
  RESUME_SESSION_REQ: 1005,
  RESUME_SESSION_RESP: 1006,
  HEARTBEAT_REQ: 1101,
  HEARTBEAT_RESP: 1102,
  PUSH_MSG: 3001,
  ACK_REQ: 4001,
  ACK_RESP: 4002,
  ERROR_RESP: 9001
} as const;

const UINT64_PATTERN = /^\d+$/;

type DirectGatewayClientOptions = {
  wsUrl: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
};

type PendingRequest<TPayload> = {
  expectedType: number;
  decoderType: string;
  resolve: (payload: TPayload) => void;
  reject: (error: Error) => void;
  timer: number;
  startedAt: number;
};

type ProtoCommonResponse = {
  code: number;
  message: string;
  requestId?: string;
};

type ProtoRegisterResponse = {
  response: ProtoCommonResponse;
  userId: string;
};

type ProtoLoginResponse = {
  response: ProtoCommonResponse;
  userId: string;
  token: string;
  expireAt: string | number;
};

type ProtoResumeSessionResponse = {
  response: ProtoCommonResponse;
  userId: string;
};

type ProtoMessageData = {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toUserId?: string;
  groupId?: string;
  content: string;
  contentType: string | number;
  timestamp: string | number;
  serverTimestamp?: string | number;
  recalled?: boolean;
  recalledAt?: string | number;
};

export class GatewayOperationError extends Error {
  constructor(
    message: string,
    readonly code: number
  ) {
    super(message);
    this.name = "GatewayOperationError";
  }
}

export function isExpiredGatewaySession(error: unknown) {
  return error instanceof GatewayOperationError && [3000, 3001, 3007].includes(error.code);
}

export class DirectGatewayClient implements GatewayClient {
  private ws?: WebSocket;
  private codec = new BrowserPacketCodec();
  private sequenceId = 1;
  private pending = new Map<number, PendingRequest<unknown>>();
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private heartbeatTimer?: number;
  private reconnectTimer?: number;
  private manualClose = false;
  private connectPromise?: Promise<void>;
  private connectedAt?: number;
  private latency = 0;
  private reconnectAttempts = 0;
  private userId = "";
  private token = "";

  constructor(private readonly options: DirectGatewayClientOptions) {}

  setSession(token: string, userId: string): void {
    this.token = token;
    this.userId = userId;
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.manualClose = false;
    this.emitStatus({ state: "reconnecting", heartbeatOk: false, latency: this.latency });

    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.wsUrl);
      ws.binaryType = "arraybuffer";
      this.ws = ws;
      let settled = false;

      const resolveConnection = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const rejectConnection = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const timeout = window.setTimeout(() => {
        this.connectPromise = undefined;
        rejectConnection(new Error("Gateway WebSocket connection timeout."));
        ws.close();
      }, 8000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        void this.finishConnectionOpen()
          .then(() => {
            this.reconnectAttempts = 0;
            this.connectedAt = Date.now();
            this.connectPromise = undefined;
            this.emitStatus({ state: "connected", heartbeatOk: true, latency: this.latency, connectedAt: this.connectedAt });
            this.startHeartbeat();
            resolveConnection();
          })
          .catch((error) => {
            this.connectPromise = undefined;
            const sessionExpired = isExpiredGatewaySession(error);
            this.manualClose = sessionExpired;
            const message = error instanceof Error ? error.message : "Gateway session resume failed.";
            this.emitStatus({
              state: "disconnected",
              heartbeatOk: false,
              latency: this.latency,
              error: message,
              sessionExpired
            });
            rejectConnection(error instanceof Error ? error : new Error(message));
            ws.close();
          });
      };
      ws.onmessage = (event) => void this.handleMessage(event.data);
      ws.onerror = () => {
        this.emitStatus({ state: "disconnected", heartbeatOk: false, latency: this.latency, error: "Gateway WebSocket error." });
      };
      ws.onclose = () => {
        window.clearTimeout(timeout);
        this.connectPromise = undefined;
        this.stopHeartbeat();
        this.rejectPending("Gateway WebSocket disconnected.");
        this.emitStatus({ state: "disconnected", heartbeatOk: false, latency: this.latency, error: "Gateway WebSocket disconnected." });
        rejectConnection(new Error("Gateway WebSocket disconnected."));
        if (!this.manualClose && this.options.autoReconnect) this.scheduleReconnect();
      };
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.manualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.rejectPending("Gateway WebSocket disconnected.");
    this.connectPromise = undefined;
    this.ws?.close();
    this.ws = undefined;
    this.userId = "";
    this.token = "";
    this.emitStatus({ state: "disconnected", heartbeatOk: false, latency: 0 });
  }

  async register(username: string, password: string, nickname: string): Promise<RegisterResult> {
    await this.connect();
    const payload = await this.request<ProtoRegisterResponse>(
      MessageType.REGISTER_REQ,
      MessageType.REGISTER_RESP,
      "nebula.proto.RegisterRequest",
      {
        requestId: this.requestId("register"),
        username,
        password,
        nickname: nickname || username
      },
      "nebula.proto.RegisterResponse"
    );
    this.assertOk(payload.response, "Register");
    return {
      userId: payload.userId,
      username,
      nickname: nickname || username
    };
  }

  async login(username: string, password: string): Promise<LoginResult> {
    await this.connect();
    const payload = await this.request<ProtoLoginResponse>(
      MessageType.LOGIN_REQ,
      MessageType.LOGIN_RESP,
      "nebula.proto.LoginRequest",
      {
        requestId: this.requestId("login"),
        username,
        password,
        deviceId: currentDeviceId(),
        platform: "web",
        deviceName: "NebulaIM Web"
      },
      "nebula.proto.LoginResponse"
    );
    this.assertLoginOk(payload.response);
    this.userId = payload.userId;
    this.token = payload.token;
    return {
      userId: payload.userId,
      username,
      token: payload.token,
      expireAt: Number(payload.expireAt ?? 0)
    };
  }

  async ackMessage(messageId: string, userId = this.userId): Promise<void> {
    const response = await this.request<{ response: ProtoCommonResponse }>(
      MessageType.ACK_REQ,
      MessageType.ACK_RESP,
      "nebula.proto.AckMessageRequest",
      {
        requestId: this.requestId("ack"),
        userId: toProtoUInt64(userId, "userId"),
        messageId: toProtoUInt64(messageId, "messageId")
      },
      "nebula.proto.AckMessageResponse"
    );
    this.assertOk(response.response, "AckMessage");
  }

  sendHeartbeat(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const startedAt = Date.now();
    this.requestRaw<ProtoCommonResponse>(
      MessageType.HEARTBEAT_REQ,
      MessageType.HEARTBEAT_RESP,
      new Uint8Array(),
      "nebula.proto.CommonResponse"
    )
      .then((response) => {
        this.assertOk(response, "Heartbeat");
        this.latency = Date.now() - startedAt;
        this.emitStatus({
          state: "connected",
          heartbeatOk: true,
          latency: this.latency,
          connectedAt: this.connectedAt,
          lastHeartbeatAt: Date.now()
        });
      })
      .catch((error) => {
        this.emitStatus({
          state: "connected",
          heartbeatOk: false,
          latency: this.latency,
          connectedAt: this.connectedAt,
          error: error.message
        });
      });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
  }

  onStatusChange(handler: StatusHandler): void {
    this.statusHandlers.add(handler);
    if (this.ws?.readyState === WebSocket.OPEN) {
      handler({
        state: "connected",
        heartbeatOk: true,
        latency: this.latency,
        connectedAt: this.connectedAt,
        lastHeartbeatAt: Date.now(),
        gatewayUrl: this.options.wsUrl
      });
    }
  }

  private async request<TPayload>(
    type: number,
    responseType: number,
    requestType: string,
    payload: Record<string, unknown>,
    responseProtoType: string
  ) {
    const body = await encodeProto(requestType, payload);
    return this.requestRaw<TPayload>(type, responseType, body, responseProtoType);
  }

  private requestRaw<TPayload>(type: number, responseType: number, body: Uint8Array, responseProtoType: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Gateway WebSocket is not connected."));
    }

    const sequenceId = this.sequenceId;
    this.sequenceId = this.sequenceId >= 0xffff_ffff ? 1 : this.sequenceId + 1;
    const frame = this.codec.encode({ type, sequenceId, body });
    this.ws.send(frame);

    return new Promise<TPayload>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(sequenceId);
        reject(new Error(`Gateway request timeout: ${type}`));
      }, 8000);

      this.pending.set(sequenceId, {
        expectedType: responseType,
        decoderType: responseProtoType,
        resolve: resolve as (payload: unknown) => void,
        reject,
        timer,
        startedAt: Date.now()
      });
    });
  }

  private async handleMessage(data: unknown): Promise<void> {
    try {
      const packet = this.codec.decode(data as ArrayBuffer);
      if (packet.type === MessageType.PUSH_MSG) {
        const message = await decodeProto<ProtoMessageData>("nebula.proto.MessageData", packet.body);
        this.messageHandlers.forEach((handler) => handler(this.toMessage(message)));
        return;
      }

      const pending = this.pending.get(packet.sequenceId);
      if (!pending) {
        if (packet.type === MessageType.ERROR_RESP) {
          const error = await decodeProto<ProtoCommonResponse>("nebula.proto.CommonResponse", packet.body);
          this.emitStatus({ state: "connected", heartbeatOk: false, latency: this.latency, error: error.message });
        }
        return;
      }

      window.clearTimeout(pending.timer);
      this.pending.delete(packet.sequenceId);

      if (packet.type === MessageType.ERROR_RESP) {
        const error = await decodeProto<ProtoCommonResponse>("nebula.proto.CommonResponse", packet.body);
        pending.reject(new Error(error.message || `Gateway error code ${error.code}`));
        return;
      }

      if (packet.type !== pending.expectedType) {
        pending.reject(new Error(`Unexpected Gateway response type: ${packet.type}`));
        return;
      }

      const payload = await decodeProto<unknown>(pending.decoderType, packet.body);
      pending.resolve(payload);
    } catch (error) {
      clientLogger.warn("Direct Gateway packet handling failed", error);
      this.emitStatus({
        state: this.ws?.readyState === WebSocket.OPEN ? "connected" : "disconnected",
        heartbeatOk: false,
        latency: this.latency,
        error: error instanceof Error ? error.message : "Gateway packet handling failed."
      });
    }
  }

  private toMessage(payload: ProtoMessageData): Message {
    const groupId = payload.groupId && payload.groupId !== "0" ? payload.groupId : undefined;
    const fromUserId = payload.fromUserId;
    const toUserId = payload.toUserId && payload.toUserId !== "0" ? payload.toUserId : undefined;
    return {
      id: payload.messageId,
      conversationId: groupId ? `group-${groupId}` : `direct-${fromUserId === this.userId ? toUserId ?? fromUserId : fromUserId}`,
      fromUserId,
      toUserId,
      groupId,
      content: payload.content,
      contentType: fromProtoContentType(payload.contentType),
      status: "delivered",
      createdAt: requiredProtoTimestamp(payload.serverTimestamp || payload.timestamp),
      isMine: fromUserId === this.userId,
      recalled: Boolean(payload.recalled),
      recalledAt: Number(payload.recalledAt ?? 0)
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), this.options.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.emitStatus({ state: "reconnecting", heartbeatOk: false, latency: this.latency });
    const waitMs = Math.min(10_000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect().catch((error) => {
        clientLogger.warn("Gateway reconnect attempt failed", error);
      });
    }, waitMs);
  }

  private async finishConnectionOpen(): Promise<void> {
    if (!this.token) return;
    const payload = await this.request<ProtoResumeSessionResponse>(
      MessageType.RESUME_SESSION_REQ,
      MessageType.RESUME_SESSION_RESP,
      "nebula.proto.ResumeSessionRequest",
      {
        requestId: this.requestId("resume-session"),
        token: this.token,
        deviceId: currentDeviceId(),
        platform: "web",
        deviceName: "NebulaIM Web"
      },
      "nebula.proto.ResumeSessionResponse"
    );
    this.assertOk(payload.response, "ResumeSession");
    if (!payload.userId || payload.userId === "0") {
      throw new Error("ResumeSession returned an invalid user.");
    }
    if (this.userId && payload.userId !== this.userId) {
      throw new Error("ResumeSession returned a different user.");
    }
    this.userId = payload.userId;
  }

  private rejectPending(message: string): void {
    for (const [id, pending] of this.pending) {
      window.clearTimeout(pending.timer);
      pending.reject(new Error(message));
      this.pending.delete(id);
    }
  }

  private assertOk(response: ProtoCommonResponse | undefined, operation: string): void {
    if (!response) throw new Error(`${operation} returned an empty response.`);
    if (response.code !== 0) {
      throw new GatewayOperationError(response.message || `${operation} failed with code ${response.code}.`, response.code);
    }
  }

  private assertLoginOk(response: ProtoCommonResponse | undefined): void {
    if (!response) throw new Error("Login returned an empty response.");
    if (response.code === 0) return;
    throw new Error(response.message || `Login failed with code ${response.code}.`);
  }

  private requestId(prefix: string) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  private emitStatus(status: Omit<GatewayStatus, "gatewayUrl">): void {
    const fullStatus: GatewayStatus = {
      ...status,
      gatewayUrl: this.options.wsUrl
    };
    this.statusHandlers.forEach((handler) => handler(fullStatus));
  }
}

function toProtoUInt64(value: string | number, fieldName: string): string | number {
  const normalized = String(value);
  if (!UINT64_PATTERN.test(normalized)) {
    throw new Error(`${fieldName} must be an unsigned integer.`);
  }
  const numericValue = Number(normalized);
  return Number.isSafeInteger(numericValue) ? numericValue : normalized;
}

function fromProtoContentType(contentType: string | number | undefined): MessageContentType {
  return contentType === 2 || contentType === "2" || contentType === "MESSAGE_CONTENT_TYPE_IMAGE" ? "image" : "text";
}

function requiredProtoTimestamp(value: string | number | undefined) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error("Gateway pushed a message without a valid timestamp.");
  }
  return timestamp;
}
