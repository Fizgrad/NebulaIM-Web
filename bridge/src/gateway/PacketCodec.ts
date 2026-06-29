import { BridgeError } from "../errors/BridgeError.js";
import { MessageType } from "./MessageType.js";
import {
  DEFAULT_MAX_BODY_LENGTH,
  PACKET_HEADER_LENGTH,
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
  type Packet
} from "./Packet.js";
import { TcpBuffer } from "./TcpBuffer.js";

export type { Packet };

export class PacketCodec {
  private receiveBuffer = new TcpBuffer();

  constructor(private readonly maxBodyLength = DEFAULT_MAX_BODY_LENGTH) {}

  encode(packet: Packet): Buffer {
    if (packet.body.length > this.maxBodyLength) {
      throw new BridgeError({
        code: "GATEWAY_PACKET_ERROR",
        message: `Packet body too large: ${packet.body.length}`
      });
    }

    const header = Buffer.alloc(PACKET_HEADER_LENGTH);
    header.writeUInt32BE(PROTOCOL_MAGIC, 0);
    header.writeUInt16BE(PROTOCOL_VERSION, 4);
    header.writeUInt16BE(packet.type, 6);
    header.writeUInt32BE(packet.sequenceId, 8);
    header.writeUInt32BE(packet.body.length, 12);
    return Buffer.concat([header, packet.body]);
  }

  appendData(data: Buffer): Packet[] {
    this.receiveBuffer.append(data);
    const packets: Packet[] = [];

    while (this.receiveBuffer.length() >= PACKET_HEADER_LENGTH) {
      const magic = this.receiveBuffer.readUInt32BE(0);
      if (magic !== PROTOCOL_MAGIC) {
        this.clear();
        throw new BridgeError({
          code: "GATEWAY_PACKET_ERROR",
          message: `Invalid packet magic: 0x${magic.toString(16)}`
        });
      }

      const version = this.receiveBuffer.readUInt16BE(4);
      if (version !== PROTOCOL_VERSION) {
        this.clear();
        throw new BridgeError({
          code: "GATEWAY_PACKET_ERROR",
          message: `Unsupported packet version: ${version}`
        });
      }

      const type = this.receiveBuffer.readUInt16BE(6) as MessageType;
      const sequenceId = this.receiveBuffer.readUInt32BE(8);
      const bodyLength = this.receiveBuffer.readUInt32BE(12);

      if (bodyLength > this.maxBodyLength) {
        this.clear();
        throw new BridgeError({
          code: "GATEWAY_PACKET_ERROR",
          message: `Packet body length exceeds limit: ${bodyLength}`
        });
      }

      const packetLength = PACKET_HEADER_LENGTH + bodyLength;
      if (this.receiveBuffer.length() < packetLength) {
        break;
      }

      const body = this.receiveBuffer.slice(PACKET_HEADER_LENGTH, packetLength);
      packets.push({ type, sequenceId, body });
      this.receiveBuffer.consume(packetLength);
    }

    return packets;
  }

  clear(): void {
    this.receiveBuffer.clear();
  }
}
