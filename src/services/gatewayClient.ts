import { ackMessage, pullOfflineMessages, sendGroupMessage, sendSingleMessage } from "../api/chatApi";
import { login as mockLogin, register as mockRegister } from "../api/authApi";
import { delay } from "../api/client";
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
import { createId } from "../utils/id";
import { MockSocket } from "./mockSocket";
import { DirectGatewayClient } from "./directGatewayClient";
import { RealGatewayClient } from "./realGatewayClient";
import { useSettingsStore } from "../store/settingsStore";

export type { GatewayClient, GatewayStatus, MessageHandler, StatusHandler };

export class MockGatewayClient implements GatewayClient {
  private socket = new MockSocket();
  private token?: string;

  async connect() {
    await this.socket.connect();
  }

  disconnect() {
    this.socket.disconnect();
  }

  async register(username: string, password: string, nickname: string): Promise<RegisterResult> {
    const response = await mockRegister(username, password, nickname);
    return {
      userId: response.user.id,
      username: response.user.username,
      nickname: response.user.nickname
    };
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const response = await mockLogin(username, password);
    this.token = response.token;
    return {
      userId: response.user.id,
      username: response.user.username,
      nickname: response.user.nickname,
      token: response.token
    };
  }

  async sendSingleMessage(payload: SendSingleMessagePayload): Promise<SendMessageResult> {
    void this.token;
    const response = await sendSingleMessage(payload);
    return {
      messageId: response.messageId,
      status: "sent",
      serverTimestamp: response.createdAt
    };
  }

  async sendGroupMessage(payload: SendGroupMessagePayload): Promise<SendMessageResult> {
    void this.token;
    const response = await sendGroupMessage(payload);
    return {
      messageId: response.messageId,
      status: "sent",
      serverTimestamp: response.createdAt
    };
  }

  async ackMessage(messageId: string): Promise<void> {
    await ackMessage(messageId);
  }

  async pullOfflineMessages(): Promise<Message[]> {
    return pullOfflineMessages();
  }

  sendHeartbeat() {
    this.socket.sendHeartbeat();
  }

  onMessage(handler: MessageHandler) {
    this.socket.onMessage(handler);
  }

  onStatusChange(handler: StatusHandler) {
    this.socket.onStatusChange(handler);
  }
}

let activeClient: GatewayClient | null = null;
let activeSignature = "";

function createGatewayClient(): GatewayClient {
  const settings = useSettingsStore.getState();
  if (settings.connectionMode === "real") {
    if (settings.gatewayTransport === "direct") {
      return new DirectGatewayClient({
        wsUrl: settings.directGatewayWsUrl,
        autoReconnect: settings.autoReconnect,
        heartbeatIntervalMs: settings.heartbeatIntervalMs
      });
    }
    return new RealGatewayClient({
      wsUrl: settings.bridgeWsUrl,
      httpUrl: settings.bridgeHttpUrl,
      autoReconnect: settings.autoReconnect,
      heartbeatIntervalMs: settings.heartbeatIntervalMs
    });
  }
  return new MockGatewayClient();
}

function getSignature() {
  const settings = useSettingsStore.getState();
  return [
    settings.connectionMode,
    settings.gatewayTransport,
    settings.directGatewayWsUrl,
    settings.bridgeWsUrl,
    settings.bridgeHttpUrl,
    settings.autoReconnect,
    settings.heartbeatIntervalMs
  ].join("|");
}

export function getGatewayClient(): GatewayClient {
  const signature = getSignature();
  if (!activeClient || activeSignature !== signature) {
    activeClient?.disconnect();
    activeClient = createGatewayClient();
    activeSignature = signature;
  }
  return activeClient;
}

export function resetGatewayClient() {
  activeClient?.disconnect();
  activeClient = null;
  activeSignature = "";
}

export async function waitForGatewaySettled() {
  await delay(0);
}

export function createLocalMessageId() {
  return createId("local");
}
