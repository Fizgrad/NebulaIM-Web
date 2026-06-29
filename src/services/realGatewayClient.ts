import type { ClientEvent, ServerEvent } from "../types/bridge";
import type {
  GatewayClient,
  GatewayStatus,
  LoginResult,
  MessageHandler,
  SendGroupMessagePayload,
  SendMessageResult,
  SendSingleMessagePayload,
  StatusHandler
} from "../types/gateway";
import type { Message } from "../types/message";
import { createClientEvent } from "./gatewayEvents";
import { retryWithBackoff, isTransientError } from "../utils/retry";
import { clientLogger } from "./clientLogger";

type RealGatewayClientOptions = {
  wsUrl: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
};

type PendingRequest = {
  resolve: (event: ServerEvent) => void;
  reject: (error: Error) => void;
  timer: number;
};

type LoginPayload = {
  userId: string;
  username?: string;
  nickname?: string;
  token: string;
  expireAt?: number | string;
};

type SendMessagePayload = {
  messageId: string;
  serverTimestamp?: number | string;
};

type HeartbeatPayload = {
  latency?: number;
};

type PushPayload = {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toUserId?: string;
  groupId?: string;
  content: string;
  contentType: "text";
  serverTimestamp: number;
};

type PullOfflinePayload = {
  messages: PushPayload[];
};

export class RealGatewayClient implements GatewayClient {
  private ws?: WebSocket;
  private pending = new Map<string, PendingRequest>();
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private heartbeatTimer?: number;
  private reconnectTimer?: number;
  private manualClose = false;
  private gatewayReady = false;
  private connectPromise?: Promise<void>;
  private connectWaiter?: {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: number;
  };
  private connectedAt?: number;
  private latency = 0;
  private reconnectAttempts = 0;

  constructor(private readonly options: RealGatewayClientOptions) {}

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.gatewayReady) return Promise.resolve();
    if (this.connectPromise) return this.connectPromise;
    this.manualClose = false;
    this.gatewayReady = false;
    this.emitStatus({ state: "reconnecting", heartbeatOk: false, latency: this.latency });

    this.connectPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.options.wsUrl);
      this.ws = ws;

      const timeout = window.setTimeout(() => {
        this.connectWaiter = undefined;
        this.connectPromise = undefined;
        reject(new Error("Bridge WebSocket connection timeout."));
        ws.close();
      }, 8000);

      this.connectWaiter = { resolve, reject, timer: timeout };

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.connectedAt = Date.now();
        this.emitStatus({ state: "reconnecting", heartbeatOk: false, latency: this.latency, connectedAt: this.connectedAt });
      };

      ws.onmessage = (event) => this.handleMessage(event.data);
      ws.onerror = () => {
        this.emitStatus({ state: "disconnected", heartbeatOk: false, latency: this.latency, error: "Bridge WebSocket error." });
      };
      ws.onclose = () => {
        window.clearTimeout(timeout);
        this.gatewayReady = false;
        this.connectPromise = undefined;
        if (this.connectWaiter) {
          this.connectWaiter.reject(new Error("Bridge WebSocket disconnected."));
          this.connectWaiter = undefined;
        }
        this.stopHeartbeat();
        this.rejectPending("Bridge WebSocket disconnected.");
        this.emitStatus({ state: "disconnected", heartbeatOk: false, latency: this.latency, error: "Bridge WebSocket disconnected." });
        if (!this.manualClose && this.options.autoReconnect) {
          this.scheduleReconnect();
        }
      };
    });

    return this.connectPromise;
  }

  disconnect(): void {
    this.manualClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.rejectPending("Bridge WebSocket disconnected.");
    this.gatewayReady = false;
    this.connectPromise = undefined;
    if (this.connectWaiter) {
      window.clearTimeout(this.connectWaiter.timer);
      this.connectWaiter.reject(new Error("Bridge WebSocket disconnected."));
      this.connectWaiter = undefined;
    }
    this.ws?.close();
    this.ws = undefined;
    this.emitStatus({ state: "disconnected", heartbeatOk: false, latency: 0 });
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const event = await this.requestWithRetry<LoginPayload>(
      () =>
        createClientEvent("auth.login", {
          username,
          password
        }),
      "auth.login_result",
      1
    );
    const payload = event.payload;
    if (!payload) throw new Error("Bridge login response is missing payload.");
    return {
      userId: payload.userId,
      username: payload.username ?? username,
      nickname: payload.nickname ?? username,
      token: payload.token,
      expireAt: Number(payload.expireAt ?? 0)
    };
  }

  async sendSingleMessage(payload: SendSingleMessagePayload): Promise<SendMessageResult> {
    const event = await this.requestWithRetry<SendMessagePayload>(
      () =>
        createClientEvent("message.send_single", {
          fromUserId: payload.fromUserId,
          toUserId: payload.toUserId,
          content: payload.content,
          contentType: payload.contentType,
          clientSequenceId: payload.clientSequenceId
        }),
      "message.send_single_result",
      2
    );
    return {
      messageId: event.payload?.messageId ?? "",
      status: "sent",
      serverTimestamp: Number(event.payload?.serverTimestamp ?? Date.now())
    };
  }

  async sendGroupMessage(payload: SendGroupMessagePayload): Promise<SendMessageResult> {
    const event = await this.requestWithRetry<SendMessagePayload>(
      () =>
        createClientEvent("message.send_group", {
          fromUserId: payload.fromUserId,
          groupId: payload.groupId,
          content: payload.content,
          contentType: payload.contentType,
          clientSequenceId: payload.clientSequenceId
        }),
      "message.send_group_result",
      2
    );
    return {
      messageId: event.payload?.messageId ?? "",
      status: "sent",
      serverTimestamp: Number(event.payload?.serverTimestamp ?? Date.now())
    };
  }

  async ackMessage(messageId: string, userId = ""): Promise<void> {
    await this.requestWithRetry(
      () =>
        createClientEvent("message.ack", {
          userId,
          messageId
        }),
      "message.ack_result",
      1
    );
  }

  async pullOfflineMessages(userId = ""): Promise<Message[]> {
    const event = await this.requestWithRetry<PullOfflinePayload>(
      () =>
        createClientEvent("message.pull_offline", {
          userId,
          page: 1,
          pageSize: 50
        }),
      "message.pull_offline_result",
      1
    );
    return (event.payload?.messages ?? []).map((message) => this.toMessage(message));
  }

  sendHeartbeat(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const startedAt = Date.now();
    this.request<HeartbeatPayload>(createClientEvent("connection.heartbeat", {}), "connection.heartbeat_result")
      .then((event) => {
        this.latency = Number(event.payload?.latency ?? Date.now() - startedAt);
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
  }

  private request<TPayload>(event: ClientEvent, expectedType: string): Promise<ServerEvent<TPayload>> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Bridge WebSocket is not connected."));
    }
    if (!this.gatewayReady) {
      return Promise.reject(new Error("Bridge Gateway is not connected."));
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(event.id);
        reject(new Error(`Bridge request timeout: ${event.type}`));
      }, 8000);

      this.pending.set(event.id, {
        resolve: (serverEvent) => {
          if (serverEvent.type !== expectedType && serverEvent.type !== "error") {
            reject(new Error(`Unexpected Bridge response: ${serverEvent.type}`));
            return;
          }
          if (!serverEvent.ok) {
            reject(new Error(serverEvent.error?.message ?? "Bridge request failed."));
            return;
          }
          resolve(serverEvent as ServerEvent<TPayload>);
        },
        reject,
        timer
      });

      this.ws?.send(JSON.stringify(event));
    });
  }

  private requestWithRetry<TPayload>(
    eventFactory: () => ClientEvent,
    expectedType: string,
    retries: number
  ): Promise<ServerEvent<TPayload>> {
    const event = eventFactory();
    return retryWithBackoff(() => this.request<TPayload>(event, expectedType), {
      retries,
      baseDelayMs: 350,
      maxDelayMs: 2500,
      shouldRetry: isTransientError,
      onRetry: (error, attempt, waitMs) => {
        clientLogger.warn(`WebSocket request retry type=${event.type} attempt=${attempt} wait=${waitMs}ms`, error, event.id);
      }
    });
  }

  private handleMessage(data: unknown): void {
    let event: ServerEvent;
    try {
      event = JSON.parse(String(data)) as ServerEvent;
    } catch {
      console.error("Invalid Bridge WebSocket event", data);
      return;
    }

    if (event.type === "message.push") {
      this.messageHandlers.forEach((handler) => handler(this.toMessage(event.payload as PushPayload)));
      return;
    }

    if (event.type === "connection.status") {
      const payload = event.payload as { gatewayConnected?: boolean } | undefined;
      this.gatewayReady = event.ok && payload?.gatewayConnected !== false;
      const state = this.gatewayReady ? "connected" : "disconnected";
      this.emitStatus({
        state,
        heartbeatOk: this.gatewayReady,
        latency: this.latency,
        connectedAt: this.connectedAt,
        error: event.error?.message
      });
      if (this.connectWaiter) {
        window.clearTimeout(this.connectWaiter.timer);
        if (this.gatewayReady) {
          this.connectWaiter.resolve();
          this.connectPromise = undefined;
          this.startHeartbeat();
        } else {
          this.connectWaiter.reject(new Error(event.error?.message ?? "Bridge Gateway is not connected."));
          this.connectPromise = undefined;
        }
        this.connectWaiter = undefined;
      }
      return;
    }

    const pending = this.pending.get(event.id);
    if (pending) {
      window.clearTimeout(pending.timer);
      this.pending.delete(event.id);
      pending.resolve(event);
    }
  }

  private toMessage(payload: PushPayload): Message {
    return {
      id: payload.messageId,
      conversationId: payload.conversationId,
      fromUserId: payload.fromUserId,
      toUserId: payload.toUserId,
      groupId: payload.groupId,
      content: payload.content,
      contentType: "text",
      status: "delivered",
      createdAt: Number(payload.serverTimestamp || Date.now()),
      isMine: false
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), this.options.heartbeatIntervalMs);
    this.sendHeartbeat();
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

  private emitStatus(status: Omit<GatewayStatus, "mode" | "bridgeUrl">): void {
    const fullStatus: GatewayStatus = {
      ...status,
      mode: "real",
      bridgeUrl: this.options.wsUrl
    };
    this.statusHandlers.forEach((handler) => handler(fullStatus));
  }
}
