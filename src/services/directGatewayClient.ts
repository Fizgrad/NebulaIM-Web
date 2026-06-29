import type {
  GatewayClient,
  GatewayStatus,
  LoginResult,
  MessageHandler,
  RegisterResult,
  SendGroupMessagePayload,
  SendMessageResult,
  SendSingleMessagePayload,
  StatusHandler
} from "../types/gateway";
import type { Message } from "../types/message";
import { BrowserPacketCodec } from "./browserPacketCodec";
import { decodeProto, encodeProto } from "./browserProtoRegistry";
import { clientLogger } from "./clientLogger";

const MessageType = {
  LOGIN_REQ: 1001,
  LOGIN_RESP: 1002,
  REGISTER_REQ: 1003,
  REGISTER_RESP: 1004,
  HEARTBEAT_REQ: 1101,
  HEARTBEAT_RESP: 1102,
  SEND_SINGLE_MSG_REQ: 2001,
  SEND_SINGLE_MSG_RESP: 2002,
  SEND_GROUP_MSG_REQ: 2101,
  SEND_GROUP_MSG_RESP: 2102,
  PUSH_MSG: 3001,
  ACK_REQ: 4001,
  ACK_RESP: 4002,
  PULL_OFFLINE_MSG_REQ: 5001,
  PULL_OFFLINE_MSG_RESP: 5002,
  ERROR_RESP: 9001
} as const;

const GATEWAY_ONLINE_STATE_FAILED = 10006;
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

type ProtoSendMessageResponse = {
  response: ProtoCommonResponse;
  messageId: string;
  serverTimestamp: string | number;
};

type ProtoPullOfflineMessagesResponse = {
  response: ProtoCommonResponse;
  messages: ProtoMessageData[];
};

type ProtoMessageData = {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toUserId?: string;
  groupId?: string;
  content: string;
  contentType: string;
  timestamp: string | number;
  serverTimestamp?: string | number;
};

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

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;

    this.manualClose = false;
    this.emitStatus({ state: "reconnecting", heartbeatOk: false, latency: this.latency });

    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.wsUrl);
      ws.binaryType = "arraybuffer";
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        this.connectPromise = undefined;
        reject(new Error("Gateway WebSocket connection timeout."));
        ws.close();
      }, 8000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.connectedAt = Date.now();
        this.connectPromise = undefined;
        this.emitStatus({ state: "connected", heartbeatOk: true, latency: this.latency, connectedAt: this.connectedAt });
        this.startHeartbeat();
        resolve();
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
        deviceId: this.deviceId(),
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
      nickname: username,
      token: payload.token,
      expireAt: Number(payload.expireAt ?? 0)
    };
  }

  async sendSingleMessage(payload: SendSingleMessagePayload): Promise<SendMessageResult> {
    const response = await this.request<ProtoSendMessageResponse>(
      MessageType.SEND_SINGLE_MSG_REQ,
      MessageType.SEND_SINGLE_MSG_RESP,
      "nebula.proto.SendSingleMessageRequest",
      {
        requestId: this.requestId("send-single"),
        fromUserId: toProtoUInt64(payload.fromUserId || this.userId || "0", "fromUserId"),
        toUserId: toProtoUInt64(payload.toUserId, "toUserId"),
        contentType: 1,
        content: payload.content,
        clientSequenceId: payload.clientSequenceId
      },
      "nebula.proto.SendSingleMessageResponse"
    );
    this.assertOk(response.response, "SendSingleMessage");
    return {
      messageId: response.messageId,
      status: "sent",
      serverTimestamp: Number(response.serverTimestamp || Date.now())
    };
  }

  async sendGroupMessage(payload: SendGroupMessagePayload): Promise<SendMessageResult> {
    const response = await this.request<ProtoSendMessageResponse>(
      MessageType.SEND_GROUP_MSG_REQ,
      MessageType.SEND_GROUP_MSG_RESP,
      "nebula.proto.SendGroupMessageRequest",
      {
        requestId: this.requestId("send-group"),
        fromUserId: toProtoUInt64(payload.fromUserId || this.userId || "0", "fromUserId"),
        groupId: toProtoUInt64(payload.groupId, "groupId"),
        contentType: 1,
        content: payload.content,
        clientSequenceId: payload.clientSequenceId
      },
      "nebula.proto.SendGroupMessageResponse"
    );
    this.assertOk(response.response, "SendGroupMessage");
    return {
      messageId: response.messageId,
      status: "sent",
      serverTimestamp: Number(response.serverTimestamp || Date.now())
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

  async pullOfflineMessages(userId = this.userId): Promise<Message[]> {
    const response = await this.request<ProtoPullOfflineMessagesResponse>(
      MessageType.PULL_OFFLINE_MSG_REQ,
      MessageType.PULL_OFFLINE_MSG_RESP,
      "nebula.proto.PullOfflineMessagesRequest",
      {
        requestId: this.requestId("pull-offline"),
        userId: toProtoUInt64(userId, "userId"),
        page: {
          page: 1,
          pageSize: 50
        }
      },
      "nebula.proto.PullOfflineMessagesResponse"
    );
    this.assertOk(response.response, "PullOfflineMessages");
    return response.messages.map((message) => this.toMessage(message));
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

    const sequenceId = this.sequenceId++;
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
      contentType: "text",
      status: "delivered",
      createdAt: Number(payload.serverTimestamp || payload.timestamp || Date.now()),
      isMine: fromUserId === this.userId
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
      void this.connect();
    }, waitMs);
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
    if (response.code !== 0) throw new Error(response.message || `${operation} failed with code ${response.code}.`);
  }

  private assertLoginOk(response: ProtoCommonResponse | undefined): void {
    if (!response) throw new Error("Login returned an empty response.");
    if (response.code === 0) return;
    if (response.code === GATEWAY_ONLINE_STATE_FAILED) {
      clientLogger.warn("Login succeeded but Gateway online state update failed", response);
      this.emitStatus({
        state: "connected",
        heartbeatOk: false,
        latency: this.latency,
        connectedAt: this.connectedAt,
        error: response.message || "Gateway online state failed."
      });
      return;
    }
    throw new Error(response.message || `Login failed with code ${response.code}.`);
  }

  private requestId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private deviceId() {
    const key = "nebulaim-device-id";
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.localStorage.setItem(key, value);
    }
    return value;
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
