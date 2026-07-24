import type { Router } from "express";
import express from "express";
import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { internalMetadata } from "./grpcMetadata.js";
import { grpcChannelCredentials, grpcChannelOptions } from "./grpcCredentials.js";
import { authUserId } from "./authMiddleware.js";

type CommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

type DeviceInfo = {
  userId: string | number;
  deviceId: string;
  platform: string;
  deviceName: string;
  lastLoginAt: string | number;
  lastActiveAt: string | number;
  online: boolean;
};

type ListDevicesResponse = {
  response: CommonResponse;
  devices: DeviceInfo[];
};

type DeviceUnary<TResponse> = (
  request: Record<string, unknown>,
  metadata: grpc.Metadata,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type DeviceGrpcClient = grpc.Client & {
  ListDevices: DeviceUnary<ListDevicesResponse>;
  KickDevice: DeviceUnary<CommonResponse>;
  KickAllDevices: DeviceUnary<CommonResponse>;
};

type DeviceMethod = "ListDevices" | "KickDevice" | "KickAllDevices";
type DeviceServiceConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: grpc.ChannelOptions
) => DeviceGrpcClient;

let cachedClient: DeviceGrpcClient | null = null;

export function createDeviceRouter(): Router {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const userId = authUserId(req);

    const requestId = req.header("x-request-id") ?? createId("device_list_req");
    try {
      const response = await invokeDevice<ListDevicesResponse>("ListDevices", {
        requestId,
        userId
      });

      if (!isOk(response.response)) {
        sendDeviceError(res, response.response);
        return;
      }

      res.json({
        ok: true,
        devices: (response.devices ?? []).map(toBridgeDevice)
      });
    } catch (error) {
      sendRpcError(res, "DeviceService.ListDevices failed.", error);
    }
  });

  router.post("/:deviceId/kick", async (req, res) => {
    const userId = authUserId(req);
    const deviceId = req.params.deviceId?.trim() ?? "";
    if (!deviceId) {
      sendValidationError(res, "Device ID is required.");
      return;
    }

    const requestId = req.header("x-request-id") ?? createId("device_kick_req");
    try {
      const response = await invokeDevice<CommonResponse>("KickDevice", {
        requestId,
        userId,
        deviceId
      });

      if (!isOk(response)) {
        sendDeviceError(res, response);
        return;
      }

      res.json({ ok: true, response });
    } catch (error) {
      sendRpcError(res, "DeviceService.KickDevice failed.", error);
    }
  });

  router.post("/kick-all", async (req, res) => {
    const userId = authUserId(req);

    const requestId = req.header("x-request-id") ?? createId("device_kick_all_req");
    try {
      const response = await invokeDevice<CommonResponse>("KickAllDevices", {
        requestId,
        userId
      });

      if (!isOk(response)) {
        sendDeviceError(res, response);
        return;
      }

      res.json({ ok: true, response });
    } catch (error) {
      sendRpcError(res, "DeviceService.KickAllDevices failed.", error);
    }
  });

  return router;
}

function invokeDevice<TResponse>(method: DeviceMethod, request: Record<string, unknown>) {
  return new Promise<TResponse>((resolve, reject) => {
    getDeviceClient()[method](request, internalMetadata(), { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response as TResponse);
    });
  });
}

function getDeviceClient(): DeviceGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "device.proto"), {
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
  const DeviceService = proto?.DeviceService as DeviceServiceConstructor | undefined;
  if (!DeviceService) {
    throw new Error("Failed to load nebula.proto.DeviceService from device.proto.");
  }

  cachedClient = new DeviceService(
    `${config.deviceServiceHost}:${config.deviceServicePort}`,
    grpcChannelCredentials(),
    grpcChannelOptions()
  );
  return cachedClient;
}

function toBridgeDevice(device: DeviceInfo) {
  return {
    userId: String(device.userId),
    deviceId: device.deviceId,
    platform: device.platform || "web",
    deviceName: device.deviceName || device.deviceId,
    lastLoginAt: Number(device.lastLoginAt ?? 0),
    lastActiveAt: Number(device.lastActiveAt ?? 0),
    online: Boolean(device.online)
  };
}

function isOk(response: CommonResponse | undefined) {
  return response?.code === 0;
}

function sendValidationError(res: express.Response, message: string) {
  res.status(400).json({
    ok: false,
    error: {
      code: "INVALID_DEVICE_PAYLOAD",
      message
    }
  });
}

function sendDeviceError(res: express.Response, response: CommonResponse | undefined) {
  const code = response?.code ?? -1;
  res.status(statusForDeviceCode(code)).json({
    ok: false,
    error: {
      code: deviceCodeToString(code),
      message: response?.message || "DeviceService rejected the request."
    }
  });
}

function sendRpcError(res: express.Response, message: string, error: unknown) {
  logger.warn(message, { detail: error });
  res.status(502).json({
    ok: false,
    error: {
      code: "DEVICE_SERVICE_UNAVAILABLE",
      message: error instanceof Error ? error.message : message
    }
  });
}

function statusForDeviceCode(code: number) {
  if (code === 1001) return 400;
  if (code === 3002 || code === 15001) return 404;
  if (code === 11002) return 503;
  return 502;
}

function deviceCodeToString(code: number) {
  const map: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    3002: "USER_NOT_FOUND",
    11002: "SERVICE_UNAVAILABLE",
    15001: "DEVICE_NOT_FOUND"
  };
  return map[code] ?? "DEVICE_SERVICE_ERROR";
}
