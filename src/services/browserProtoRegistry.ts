import protobuf from "protobufjs";

const protoFiles = [
  "/proto/common.proto",
  "/proto/user.proto",
  "/proto/message.proto",
  "/proto/relation.proto",
  "/proto/conversation.proto",
  "/proto/device.proto",
  "/proto/push.proto",
  "/proto/gateway.proto",
  "/proto/admin.proto"
];

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
