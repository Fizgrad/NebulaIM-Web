import protobuf from "protobufjs";
import { BridgeError } from "../errors/BridgeError.js";
import { getProtoPaths } from "./protoPaths.js";

export class ProtoRegistry {
  private root?: protobuf.Root;

  async load(): Promise<void> {
    this.root = await protobuf.load(getProtoPaths());
    this.root.resolveAll();
  }

  encode(typeName: string, payload: unknown): Buffer {
    const type = this.lookup(typeName);
    const value = payload as Record<string, unknown>;
    const error = type.verify(value);
    if (error) {
      throw new BridgeError({
        code: "PROTO_ENCODE_FAILED",
        message: `Failed to verify ${typeName}: ${error}`,
        detail: payload
      });
    }
    return Buffer.from(type.encode(type.create(value)).finish());
  }

  decode<T>(typeName: string, buffer: Buffer): T {
    try {
      const type = this.lookup(typeName);
      const message = type.decode(buffer);
      return type.toObject(message, {
        longs: String,
        enums: String,
        bytes: Buffer,
        defaults: true
      }) as T;
    } catch (error) {
      throw new BridgeError({
        code: "PROTO_DECODE_FAILED",
        message: `Failed to decode ${typeName}`,
        detail: error
      });
    }
  }

  private lookup(typeName: string): protobuf.Type {
    if (!this.root) {
      throw new BridgeError({
        code: "PROTO_DECODE_FAILED",
        message: "Protobuf registry has not been loaded."
      });
    }
    return this.root.lookupType(typeName);
  }
}
