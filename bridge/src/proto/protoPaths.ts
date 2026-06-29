import path from "node:path";
import { config } from "../config.js";

export const protoFiles = [
  "common.proto",
  "user.proto",
  "message.proto",
  "relation.proto",
  "conversation.proto",
  "device.proto",
  "push.proto",
  "gateway.proto"
];

export function getProtoPaths(): string[] {
  return protoFiles.map((file) => path.join(config.protoDir, file));
}
