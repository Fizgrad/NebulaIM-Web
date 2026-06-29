import net from "node:net";
import { BridgeError } from "../errors/BridgeError.js";
import { logger } from "../utils/logger.js";
import type { TcpGatewayClientOptions, PendingRequest } from "../types/gateway.js";
import { MessageType, isResponseType, messageTypeToString, requestToResponseType } from "./MessageType.js";
import { PacketCodec, type Packet } from "./PacketCodec.js";
import { SequenceManager } from "./SequenceManager.js";

export class TcpGatewayClient {
  private socket?: net.Socket;
  private codec = new PacketCodec();
  private sequenceManager = new SequenceManager();
  private pending = new Map<number, PendingRequest>();
  private pushHandlers = new Set<(packet: Packet) => void>();
  private closeHandlers = new Set<() => void>();
  private connected = false;
  private connecting?: Promise<void>;

  constructor(private readonly options: TcpGatewayClientOptions) {}

  connect(): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      const socket = net.createConnection(this.options.port, this.options.host, () => {
          this.connected = true;
          this.socket = socket;
          this.connecting = undefined;
          logger.info(`TCP Gateway connected ${this.options.host}:${this.options.port}`, {
            sessionId: this.options.sessionId
          });
          resolve();
        });

      socket.on("data", (data) => {
        if (Buffer.isBuffer(data)) {
          this.handleData(data);
        } else {
          this.handleData(Buffer.from(data));
        }
      });
      socket.on("error", (error) => {
        logger.error("TCP Gateway error", { sessionId: this.options.sessionId, detail: error });
        if (!this.connected) {
          this.connecting = undefined;
          reject(error);
        }
        this.rejectAll(error);
      });
      socket.on("close", () => {
        const wasConnected = this.connected;
        this.connected = false;
        this.connecting = undefined;
        this.socket = undefined;
        this.codec.clear();
        this.rejectAll(
          new BridgeError({
            code: "GATEWAY_NOT_CONNECTED",
            message: "Gateway TCP connection closed."
          })
        );
        if (wasConnected) {
          logger.warn("TCP Gateway closed", { sessionId: this.options.sessionId });
          this.closeHandlers.forEach((handler) => handler());
        }
      });
    });

    return this.connecting;
  }

  close(): void {
    this.connected = false;
    this.connecting = undefined;
    this.rejectAll(
      new BridgeError({
        code: "GATEWAY_NOT_CONNECTED",
        message: "Gateway TCP connection closed."
      })
    );
    this.socket?.destroy();
    this.socket = undefined;
    this.codec.clear();
    this.pushHandlers.clear();
    this.closeHandlers.clear();
  }

  request(type: MessageType, body: Buffer): Promise<Packet> {
    const responseType = requestToResponseType(type);
    if (responseType === MessageType.UNKNOWN) {
      return Promise.reject(
        new BridgeError({
          code: "INVALID_EVENT",
          message: `No response mapping for ${messageTypeToString(type)}`
        })
      );
    }

    const sequenceId = this.sequenceManager.next();
    const packet: Packet = { type, sequenceId, body };

    return new Promise<Packet>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(sequenceId);
        const error = new BridgeError({
          code: "GATEWAY_TIMEOUT",
          message: `Gateway request timeout for ${messageTypeToString(type)}`
        });
        logger.warn(error.message, { sessionId: this.options.sessionId });
        reject(error);
      }, this.options.timeoutMs);

      this.pending.set(sequenceId, {
        type,
        responseType,
        resolve,
        reject,
        timer,
        startedAt: Date.now()
      });

      this.writePacket(packet).catch((error) => {
        clearTimeout(timer);
        this.pending.delete(sequenceId);
        reject(error);
      });
    });
  }

  async send(type: MessageType, body: Buffer): Promise<void> {
    await this.writePacket({
      type,
      sequenceId: this.sequenceManager.next(),
      body
    });
  }

  onPush(handler: (packet: Packet) => void): void {
    this.pushHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async writePacket(packet: Packet): Promise<void> {
    if (!this.socket || !this.connected) {
      throw new BridgeError({
        code: "GATEWAY_NOT_CONNECTED",
        message: "Gateway TCP connection is not connected."
      });
    }

    const frame = this.codec.encode(packet);
    await new Promise<void>((resolve, reject) => {
      this.socket?.write(frame, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    logger.debug(`TCP packet sent ${messageTypeToString(packet.type)} seq=${packet.sequenceId}`, {
      sessionId: this.options.sessionId
    });
  }

  private handleData(data: Buffer): void {
    let packets: Packet[];
    try {
      packets = this.codec.appendData(data);
    } catch (error) {
      logger.error("Packet decode error", { sessionId: this.options.sessionId, detail: error });
      this.close();
      this.closeHandlers.forEach((handler) => handler());
      return;
    }

    for (const packet of packets) {
      this.handlePacket(packet);
    }
  }

  private handlePacket(packet: Packet): void {
    logger.debug(`TCP packet received ${messageTypeToString(packet.type)} seq=${packet.sequenceId}`, {
      sessionId: this.options.sessionId
    });

    const pending = this.pending.get(packet.sequenceId);
    if (pending && (packet.type === pending.responseType || packet.type === MessageType.ERROR_RESP)) {
      clearTimeout(pending.timer);
      this.pending.delete(packet.sequenceId);
      pending.resolve(packet);
      return;
    }

    if (packet.type === MessageType.PUSH_MSG || packet.type === MessageType.ERROR_RESP || !isResponseType(packet.type)) {
      this.pushHandlers.forEach((handler) => handler(packet));
    }
  }

  private rejectAll(error: Error): void {
    for (const [sequenceId, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(sequenceId);
    }
  }
}
