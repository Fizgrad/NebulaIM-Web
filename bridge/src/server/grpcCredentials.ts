import fs from "node:fs";
import * as grpc from "@grpc/grpc-js";
import { config } from "../config.js";

let cachedCredentials: grpc.ChannelCredentials | null = null;

export function grpcChannelCredentials() {
  if (cachedCredentials) return cachedCredentials;
  if (!config.grpcTlsEnabled) {
    cachedCredentials = grpc.credentials.createInsecure();
    return cachedCredentials;
  }

  const rootCertificate = fs.readFileSync(config.grpcTlsCaFile);
  const privateKey = config.grpcTlsKeyFile ? fs.readFileSync(config.grpcTlsKeyFile) : null;
  const certificateChain = config.grpcTlsCertFile ? fs.readFileSync(config.grpcTlsCertFile) : null;
  cachedCredentials = grpc.credentials.createSsl(rootCertificate, privateKey, certificateChain);
  return cachedCredentials;
}

export function grpcChannelOptions(): grpc.ChannelOptions {
  if (!config.grpcTlsServerName) return {};
  return {
    "grpc.ssl_target_name_override": config.grpcTlsServerName,
    "grpc.default_authority": config.grpcTlsServerName
  };
}
