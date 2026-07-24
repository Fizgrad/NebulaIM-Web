import type { Router } from "express";
import express from "express";
import { z } from "zod";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import {
  invokeGetUserByUsername,
  invokeGetUserInfo,
  invokeRefreshToken,
  invokeRegister,
  statusForUserCode,
  userCodeToString
} from "./userServiceClient.js";
import { deviceIdSchema, numericIdSchema } from "./validation.js";

const registerSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(64, "Username is too long."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(256, "Password is too long."),
  nickname: z.string().trim().max(64, "Nickname is too long.").optional().default("")
});

const refreshSchema = z.object({
  token: z.string().min(1, "Token is required.").max(256, "Token is too long."),
  deviceId: deviceIdSchema
});

const usernameParamSchema = z.string().trim().min(1, "Username is required.").max(64, "Username is too long.");

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
    const parsed = numericIdSchema.safeParse(req.params.userId);
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
        userId: parsed.data
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

      logger.info(`User registered user=${response.userId}`);
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

      logger.info(`Token refreshed user=${response.userId}`);
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
