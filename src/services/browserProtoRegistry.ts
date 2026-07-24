import Long from "long";
import protobuf from "protobufjs";

// protobufjs cannot preserve uint64 values in browser ESM builds unless long.js
// is configured explicitly. NebulaIM Snowflake IDs are larger than 2^53.
if (protobuf.util.Long !== Long) {
  protobuf.util.Long = Long;
  protobuf.configure();
}

const protoBasePath = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

const protoFiles = [
  "common.proto",
  "user.proto",
  "message.proto",
  "relation.proto",
  "conversation.proto",
  "device.proto",
  "push.proto",
  "gateway.proto",
  "admin.proto"
].map((fileName) => `${protoBasePath}proto/${fileName}`);

let rootPromise: Promise<protobuf.Root> | null = null;

export async function getBrowserProtoRoot() {
  if (!rootPromise) {
    rootPromise = protobuf.load(protoFiles).then((root) => {
      root.resolveAll();
      return root;
    });
  }
  return rootPromise;
}

export async function encodeProto(typeName: string, payload: Record<string, unknown>) {
  const root = await getBrowserProtoRoot();
  const type = root.lookupType(typeName);
  const message = type.fromObject(payload);
  const error = type.verify(message);
  if (error) {
    throw new Error(`Failed to encode ${typeName}: ${error}`);
  }
  return type.encode(message).finish();
}

export async function decodeProto<T>(typeName: string, body: Uint8Array): Promise<T> {
  const root = await getBrowserProtoRoot();
  const type = root.lookupType(typeName);
  const message = type.decode(body);
  return type.toObject(message, {
    longs: String,
    enums: String,
    defaults: true
  }) as T;
}
