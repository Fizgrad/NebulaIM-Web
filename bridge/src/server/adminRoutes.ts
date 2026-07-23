import type { Router } from "express";
import express from "express";
import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

type GrpcCallback<T> = (error: grpc.ServiceError | null, response: T) => void;

type AdminCommonResponse = {
  code: number;
  message?: string;
  requestId?: string;
};

type AdminResponseEnvelope = {
  response?: AdminCommonResponse;
};

type AdminGrpcClient = grpc.Client & {
  HealthCheck: AdminUnaryMethod;
  GetSystemStats: AdminUnaryMethod;
  GetOutboxStats: AdminUnaryMethod;
  GetKafkaLagInfo: AdminUnaryMethod;
  RunCleanup: AdminUnaryMethod;
  GetServiceOverview: AdminUnaryMethod;
  ListAuditEvents: AdminUnaryMethod;
};

type AdminUnaryMethod = (
  request: Record<string, unknown>,
  metadata: grpc.Metadata,
  options: grpc.CallOptions,
  callback: GrpcCallback<unknown>
) => void;
type AdminMethod =
  | "HealthCheck"
  | "GetSystemStats"
  | "GetOutboxStats"
  | "GetKafkaLagInfo"
  | "RunCleanup"
  | "GetServiceOverview"
  | "ListAuditEvents";
type ServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => AdminGrpcClient;

let cachedClient: AdminGrpcClient | null = null;

export function createAdminRouter(): Router {
  const router = express.Router();

  router.get("/health", async (req, res) => {
    await callAdmin(req, res, "HealthCheck", {});
  });

  router.get("/system-stats", async (req, res) => {
    await callAdmin(req, res, "GetSystemStats", {});
  });

  router.get("/outbox-stats", async (req, res) => {
    await callAdmin(req, res, "GetOutboxStats", {});
  });

  router.get("/kafka-lag", async (req, res) => {
    await callAdmin(req, res, "GetKafkaLagInfo", {});
  });

  router.get("/service-overview", async (req, res) => {
    await callAdmin(req, res, "GetServiceOverview", {});
  });

  router.get("/audit-events", async (req, res) => {
    const limitValue = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 100) : 20;
    await callAdmin(req, res, "ListAuditEvents", { limit });
  });

  router.post("/cleanup", async (req, res) => {
    const body = req.body as { dryRun?: boolean };
    await callAdmin(req, res, "RunCleanup", { dryRun: body.dryRun ?? true });
  });

  return router;
}

async function callAdmin(req: express.Request, res: express.Response, method: AdminMethod, payload: Record<string, unknown>) {
  const requestId = req.header("x-request-id") ?? createId("admin_req");
  const traceId = req.header("x-trace-id") ?? requestId;
  const adminToken = req.header("x-nebula-admin-token") ?? "";
  if (!adminToken) {
    res.status(401).json({
      ok: false,
      error: {
        code: "ADMIN_TOKEN_REQUIRED",
        message: "Admin token is required."
      }
    });
    return;
  }

  try {
    const data = await invokeAdmin(method, { requestId, ...payload }, adminToken, traceId);
    const common = commonAdminResponse(data);
    if (common && common.code !== 0) {
      sendAdminError(res, common);
      return;
    }
    res.json({ ok: true, data });
  } catch (error) {
    logger.warn(`Admin RPC failed method=${method}`, { detail: error });
    res.status(502).json({
      ok: false,
      error: {
        code: "ADMIN_RPC_FAILED",
        message: error instanceof Error ? error.message : "Admin RPC failed."
      }
    });
  }
}

function commonAdminResponse(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const response = (data as AdminResponseEnvelope).response;
  if (!response || typeof response.code !== "number") return null;
  return response;
}

function sendAdminError(res: express.Response, response: AdminCommonResponse) {
  res.status(statusForAdminCode(response)).json({
    ok: false,
    error: {
      code: adminCodeToString(response.code),
      message: response.message || "AdminService rejected the request."
    }
  });
}

function statusForAdminCode(response: AdminCommonResponse) {
  if (response.code === 3000) {
    return response.message?.toLowerCase().includes("permission") ? 403 : 401;
  }
  if (response.code === 1001) return 400;
  if (response.code === 11002) return 503;
  return 502;
}

function adminCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    3000: "AUTH_FAILED",
    11002: "SERVICE_UNAVAILABLE"
  };
  return names[code] ?? `ADMIN_SERVICE_ERROR_${code}`;
}

function invokeAdmin(method: AdminMethod, request: Record<string, unknown>, adminToken: string, traceId: string) {
  return new Promise<unknown>((resolve, reject) => {
    const client = getAdminClient();
    const metadata = new grpc.Metadata();
    metadata.set("x-nebula-admin-token", adminToken);
    metadata.set("x-nebula-trace-id", traceId);
    client[method](request, metadata, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function getAdminClient(): AdminGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "admin.proto"), {
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
  const AdminService = proto?.AdminService as ServiceConstructor | undefined;
  if (!AdminService) {
    throw new Error("Failed to load nebula.proto.AdminService from admin.proto.");
  }

  cachedClient = new AdminService(
    `${config.adminServiceHost}:${config.adminServicePort}`,
    grpc.credentials.createInsecure()
  );
  return cachedClient;
}
