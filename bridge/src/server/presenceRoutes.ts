import type { Router } from "express";
import express from "express";
import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { internalMetadata } from "./grpcMetadata.js";
import { grpcChannelCredentials, grpcChannelOptions } from "./grpcCredentials.js";

type CommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

type GetOnlineStatusResponse = {
  response: CommonResponse;
  online: boolean;
  gatewayId: string;
  connectionId: string;
};

type PresenceInfo = {
  userId: string;
  online: boolean;
  gatewayId: string;
  connectionId: string;
};

type GatewayUnary<TResponse> = (
  request: Record<string, unknown>,
  metadata: grpc.Metadata,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type GatewayGrpcClient = grpc.Client & {
  GetOnlineStatus: GatewayUnary<GetOnlineStatusResponse>;
};

type GatewayServiceConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: grpc.ChannelOptions
) => GatewayGrpcClient;

const numericIdSchema = z.string().regex(/^\d+$/, "User ID must be numeric.");

const presenceQuerySchema = z.object({
  userIds: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .pipe(z.array(numericIdSchema).min(1, "At least one user ID is required.").max(100, "Too many user IDs."))
});

let cachedClient: GatewayGrpcClient | null = null;

export function createPresenceRouter(): Router {
  const router = express.Router();

  router.get("/users", async (req, res) => {
    const parsed = presenceQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_PRESENCE_QUERY",
          message: parsed.error.issues[0]?.message ?? "Invalid presence query."
        }
      });
      return;
    }

    const uniqueUserIds = Array.from(new Set(parsed.data.userIds));
    try {
      const users = await Promise.all(uniqueUserIds.map(getOnlineStatus));
      res.json({ ok: true, users });
    } catch (error) {
      logger.warn("GatewayService.GetOnlineStatus failed.", { detail: error });
      res.status(502).json({
        ok: false,
        error: {
          code: "GATEWAY_SERVICE_UNAVAILABLE",
          message: error instanceof Error ? error.message : "GatewayService.GetOnlineStatus failed."
        }
      });
    }
  });

  return router;
}

async function getOnlineStatus(userId: string): Promise<PresenceInfo> {
  const response = await invokeGateway<GetOnlineStatusResponse>("GetOnlineStatus", {
    requestId: createId("presence_req"),
    userId
  });
  if (response.response?.code !== 0) {
    throw new Error(response.response?.message || "GatewayService.GetOnlineStatus rejected the request.");
  }
  return {
    userId,
    online: Boolean(response.online),
    gatewayId: response.gatewayId || "",
    connectionId: response.connectionId || ""
  };
}

function invokeGateway<TResponse>(method: "GetOnlineStatus", request: Record<string, unknown>) {
  return new Promise<TResponse>((resolve, reject) => {
    const metadata = internalMetadata();
    getGatewayClient()[method](request, metadata, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response as TResponse);
    });
  });
}

function getGatewayClient(): GatewayGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "gateway.proto"), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [config.protoDir]
  });
  const loaded = grpc.loadPackageDefinition(packageDefinition);
  const nebula = loaded.nebula as grpc.GrpcObject | undefined;
  const proto = nebula?.proto as grpc.GrpcObject | undefined;
  const GatewayService = proto?.GatewayService as GatewayServiceConstructor | undefined;
  if (!GatewayService) {
    throw new Error("Failed to load nebula.proto.GatewayService from gateway.proto.");
  }

  cachedClient = new GatewayService(
    `${config.gatewayServiceHost}:${config.gatewayServicePort}`,
    grpcChannelCredentials(),
    grpcChannelOptions()
  );
  return cachedClient;
}
