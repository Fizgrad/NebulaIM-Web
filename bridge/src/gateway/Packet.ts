import type { MessageType } from "./MessageType.js";

export const PROTOCOL_MAGIC = 0x4e494d42;
export const PROTOCOL_VERSION = 1;
export const PACKET_HEADER_LENGTH = 16;
export const DEFAULT_MAX_BODY_LENGTH = 1024 * 1024;

export type Packet = {
  type: MessageType;
  sequenceId: number;
  body: Buffer;
};
