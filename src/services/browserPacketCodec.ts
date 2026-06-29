export const PROTOCOL_MAGIC = 0x4e494d42;
export const PROTOCOL_VERSION = 1;
export const PACKET_HEADER_LENGTH = 16;
export const MAX_BODY_LENGTH = 1024 * 1024;

export type BrowserPacket = {
  type: number;
  sequenceId: number;
  body: Uint8Array;
};

export class BrowserPacketCodec {
  encode(packet: BrowserPacket): Uint8Array {
    if (packet.body.byteLength > MAX_BODY_LENGTH) {
      throw new Error(`Packet body too large: ${packet.body.byteLength}`);
    }

    const bytes = new Uint8Array(PACKET_HEADER_LENGTH + packet.body.byteLength);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, PROTOCOL_MAGIC, false);
    view.setUint16(4, PROTOCOL_VERSION, false);
    view.setUint16(6, packet.type, false);
    view.setUint32(8, packet.sequenceId >>> 0, false);
    view.setUint32(12, packet.body.byteLength >>> 0, false);
    bytes.set(packet.body, PACKET_HEADER_LENGTH);
    return bytes;
  }

  decode(data: ArrayBuffer | Uint8Array): BrowserPacket {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength < PACKET_HEADER_LENGTH) {
      throw new Error("Incomplete NebulaIM packet header.");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = view.getUint32(0, false);
    if (magic !== PROTOCOL_MAGIC) {
      throw new Error(`Invalid NebulaIM packet magic: 0x${magic.toString(16)}`);
    }

    const version = view.getUint16(4, false);
    if (version !== PROTOCOL_VERSION) {
      throw new Error(`Invalid NebulaIM packet version: ${version}`);
    }

    const bodyLength = view.getUint32(12, false);
    if (bodyLength > MAX_BODY_LENGTH) {
      throw new Error(`NebulaIM packet body exceeds limit: ${bodyLength}`);
    }
    if (bytes.byteLength < PACKET_HEADER_LENGTH + bodyLength) {
      throw new Error("Incomplete NebulaIM packet body.");
    }

    return {
      type: view.getUint16(6, false),
      sequenceId: view.getUint32(8, false),
      body: bytes.slice(PACKET_HEADER_LENGTH, PACKET_HEADER_LENGTH + bodyLength)
    };
  }
}
