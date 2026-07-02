import type { Router } from "express";
import express from "express";
import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

type CommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

type RegisterResponse = {
  response: CommonResponse;
  userId: string;
};

type RefreshTokenResponse = {
  response: CommonResponse;
  userId: string;
  token: string;
  expireAt: string | number;
};

type UserInfo = {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  createdAt: string | number;
};

type GetUserInfoResponse = {
  response: CommonResponse;
  user?: UserInfo;
};

type UserGrpcClient = grpc.Client & {
  Register: (
    request: Record<string, unknown>,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: RegisterResponse) => void
  ) => void;
  RefreshToken: (
    request: Record<string, unknown>,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: RefreshTokenResponse) => void
  ) => void;
  GetUserInfo: (
    request: Record<string, unknown>,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: GetUserInfoResponse) => void
  ) => void;
  GetUserByUsername: (
    request: Record<string, unknown>,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, response: GetUserInfoResponse) => void
  ) => void;
};

type UserServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => UserGrpcClient;

const registerSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  nickname: z.string().trim().optional().default("")
});

const refreshSchema = z.object({
  token: z.string().min(1, "Token is required."),
  deviceId: z.string().trim().optional().default("web")
});

const userIdSchema = z.string().regex(/^\d+$/, "User ID must be numeric.");
const usernameParamSchema = z.string().trim().min(1, "Username is required.").max(64, "Username is too long.");

let cachedClient: UserGrpcClient | null = null;

export function createAuthRouter(): Router {
  const router = express.Router();

  router.get("/users/by-username/:username", async (req, res) => {
    const parsed = usernameParamSchema.safeParse(req.params.username);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_USERNAME",
          message: parsed.error.issues[0]?.message ?? "Invalid username."
        }
      });
      return;
    }

    const requestId = req.header("x-request-id") ?? createId("user_by_username_req");
    try {
      const response = await invokeGetUserByUsername({
        requestId,
        username: parsed.data
      });

      if (response.response.code !== 0 || !response.user) {
        res.status(statusForUserCode(response.response.code)).json({
          ok: false,
          error: {
            code: userCodeToString(response.response.code),
            message: response.response.message || "User not found."
          }
        });
        return;
      }

      res.json({
        ok: true,
        user: response.user
      });
    } catch (error) {
      logger.warn("UserService.GetUserByUsername failed", { detail: error });
      res.status(502).json({
        ok: false,
        error: {
          code: "USER_SERVICE_UNAVAILABLE",
          message: error instanceof Error ? error.message : "UserService.GetUserByUsername failed."
        }
      });
    }
  });

  router.get("/users/:userId", async (req, res) => {
    const parsed = userIdSchema.safeParse(req.params.userId);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_USER_ID",
          message: parsed.error.issues[0]?.message ?? "Invalid user ID."
        }
      });
      return;
    }

    const requestId = req.header("x-request-id") ?? createId("user_info_req");
    try {
      const response = await invokeGetUserInfo({
        requestId,
        userId: Number(parsed.data)
      });

      if (response.response.code !== 0 || !response.user) {
        res.status(statusForUserCode(response.response.code)).json({
          ok: false,
          error: {
            code: userCodeToString(response.response.code),
            message: response.response.message || "User not found."
          }
        });
        return;
      }

      res.json({
        ok: true,
        user: response.user
      });
    } catch (error) {
      logger.warn("UserService.GetUserInfo failed", { detail: error });
      res.status(502).json({
        ok: false,
        error: {
          code: "USER_SERVICE_UNAVAILABLE",
          message: error instanceof Error ? error.message : "UserService.GetUserInfo failed."
        }
      });
    }
  });

  router.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REGISTER_PAYLOAD",
          message: parsed.error.issues[0]?.message ?? "Invalid register payload."
        }
      });
      return;
    }

    const requestId = req.header("x-request-id") ?? createId("register_req");
    try {
      const response = await invokeRegister({
        requestId,
        username: parsed.data.username,
        password: parsed.data.password,
        nickname: parsed.data.nickname
      });

      if (response.response.code !== 0) {
        res.status(statusForUserCode(response.response.code)).json({
          ok: false,
          error: {
            code: userCodeToString(response.response.code),
            message: response.response.message || "Registration failed."
          }
        });
        return;
      }

      logger.info(`User registered username=${parsed.data.username} user=${response.userId}`);
      res.json({
        ok: true,
        userId: response.userId,
        username: parsed.data.username,
        nickname: parsed.data.nickname
      });
    } catch (error) {
      logger.warn("UserService.Register failed", { detail: error });
      res.status(502).json({
        ok: false,
        error: {
          code: "USER_SERVICE_UNAVAILABLE",
          message: error instanceof Error ? error.message : "UserService.Register failed."
        }
      });
    }
  });

  router.post("/refresh", async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REFRESH_PAYLOAD",
          message: parsed.error.issues[0]?.message ?? "Invalid refresh payload."
        }
      });
      return;
    }

    const requestId = req.header("x-request-id") ?? createId("refresh_req");
    try {
      const response = await invokeRefreshToken({
        requestId,
        token: parsed.data.token,
        deviceId: parsed.data.deviceId
      });

      if (response.response.code !== 0) {
        res.status(statusForUserCode(response.response.code)).json({
          ok: false,
          error: {
            code: userCodeToString(response.response.code),
            message: response.response.message || "Token refresh failed."
          }
        });
        return;
      }

      logger.info(`Token refreshed user=${response.userId} token=${tokenPrefix(response.token)}...`);
      res.json({
        ok: true,
        userId: response.userId,
        token: response.token,
        expireAt: response.expireAt
      });
    } catch (error) {
      logger.warn("UserService.RefreshToken failed", { detail: error });
      res.status(502).json({
        ok: false,
        error: {
          code: "USER_SERVICE_UNAVAILABLE",
          message: error instanceof Error ? error.message : "UserService.RefreshToken failed."
        }
      });
    }
  });

  return router;
}

function invokeRegister(request: Record<string, unknown>) {
  return new Promise<RegisterResponse>((resolve, reject) => {
    getUserClient().Register(request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function invokeRefreshToken(request: Record<string, unknown>) {
  return new Promise<RefreshTokenResponse>((resolve, reject) => {
    getUserClient().RefreshToken(request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function invokeGetUserInfo(request: Record<string, unknown>) {
  return new Promise<GetUserInfoResponse>((resolve, reject) => {
    getUserClient().GetUserInfo(request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function invokeGetUserByUsername(request: Record<string, unknown>) {
  return new Promise<GetUserInfoResponse>((resolve, reject) => {
    getUserClient().GetUserByUsername(request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

function getUserClient(): UserGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "user.proto"), {
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
  const UserService = proto?.UserService as UserServiceConstructor | undefined;
  if (!UserService) {
    throw new Error("Failed to load nebula.proto.UserService from user.proto.");
  }

  cachedClient = new UserService(
    `${config.userServiceHost}:${config.userServicePort}`,
    grpc.credentials.createInsecure()
  );
  return cachedClient;
}

function statusForUserCode(code: number) {
  if (code === 3003) return 409;
  if (code === 3002) return 404;
  if ([1001, 3004, 3005, 3006].includes(code)) return 400;
  if ([3001, 3007, 15002].includes(code)) return 401;
  return 502;
}

function userCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    3001: "TOKEN_INVALID",
    3002: "USER_NOT_FOUND",
    3003: "USER_ALREADY_EXISTS",
    3004: "PASSWORD_TOO_SHORT",
    3005: "USERNAME_EMPTY",
    3006: "PASSWORD_EMPTY",
    3007: "TOKEN_EXPIRED",
    15002: "TOKEN_REFRESH_FAILED"
  };
  return names[code] ?? `USER_SERVICE_ERROR_${code}`;
}

function tokenPrefix(token: string) {
  return token.length <= 8 ? token : token.slice(0, 8);
}
