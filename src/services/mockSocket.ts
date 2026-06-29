import type { Message } from "../types/message";
import type { GatewayStatus, MessageHandler, StatusHandler } from "../types/gateway";
import { mockConversations } from "../mocks/conversations";
import { randomInt, randomItem, createId } from "../utils/id";

const incomingSamples = [
  "MessageService has persisted the payload.",
  "The Gateway ACK arrived in 24ms.",
  "Offline pull is complete for this session.",
  "Presence cache refreshed in Redis.",
  "Kafka consumer lag is back under threshold.",
  "Delivered event has been published."
];

export class MockSocket {
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private heartbeatTimer?: number;
  private incomingTimer?: number;
  private connectVersion = 0;
  private status: GatewayStatus = {
    state: "disconnected",
    heartbeatOk: false,
    latency: 0,
    mode: "mock"
  };

  async connect() {
    const version = ++this.connectVersion;
    this.updateStatus({ state: "reconnecting", heartbeatOk: false, latency: 0, mode: "mock" });
    await new Promise<void>((resolve) => window.setTimeout(resolve, randomInt(240, 560)));
    if (version !== this.connectVersion) return;
    this.updateStatus({
      state: "connected",
      heartbeatOk: true,
      latency: randomInt(14, 34),
      connectedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
      mode: "mock"
    });
    this.startHeartbeat();
    this.startIncomingMessages();
  }

  disconnect() {
    this.connectVersion += 1;
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.incomingTimer) window.clearInterval(this.incomingTimer);
    this.updateStatus({ state: "disconnected", heartbeatOk: false, latency: 0, mode: "mock" });
    this.messageHandlers.clear();
    this.statusHandlers.clear();
  }

  async reconnect() {
    this.disconnect();
    await this.connect();
  }

  sendHeartbeat() {
    if (this.status.state !== "connected") return;
    this.updateStatus({
      ...this.status,
      heartbeatOk: true,
      latency: randomInt(12, 48),
      lastHeartbeatAt: Date.now(),
      mode: "mock"
    });
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
  }

  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.status);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = window.setInterval(() => this.sendHeartbeat(), 5000);
  }

  private startIncomingMessages() {
    if (this.incomingTimer) window.clearInterval(this.incomingTimer);
    this.incomingTimer = window.setInterval(() => {
      if (this.status.state !== "connected" || Math.random() < 0.38) return;
      const conversation = randomItem(mockConversations);
      const fromUserId = conversation.type === "single" ? conversation.targetUserId ?? "u-alice" : "u-diana";
      const message: Message = {
        id: createId("incoming"),
        conversationId: conversation.id,
        fromUserId,
        toUserId: conversation.type === "single" ? "u-current" : undefined,
        groupId: conversation.groupId,
        content: randomItem(incomingSamples),
        contentType: "text",
        status: "delivered",
        createdAt: Date.now(),
        isMine: false
      };
      this.messageHandlers.forEach((handler) => handler(message));
    }, randomInt(6500, 10500));
  }

  private updateStatus(status: GatewayStatus) {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }
}
