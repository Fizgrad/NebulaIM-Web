import * as grpc from "@grpc/grpc-js";
import { config } from "../config.js";

export function internalMetadata() {
  const metadata = new grpc.Metadata();
  if (config.internalRpcToken) {
    metadata.set("x-nebula-internal-token", config.internalRpcToken);
  }
  return metadata;
}
