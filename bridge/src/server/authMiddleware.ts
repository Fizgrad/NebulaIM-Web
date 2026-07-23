import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { invokeValidateToken, statusForUserCode, userCodeToString } from "./userServiceClient.js";

export type BridgeAuthContext = {
  userId: string;
  token: string;
};

declare module "express-serve-static-core" {
  interface Request {
    auth?: BridgeAuthContext;
  }
}

export function requireBridgeAuth(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) {
      sendUnauthorized(res, "AUTH_REQUIRED", "Bearer token is required.");
      return;
    }

    const requestId = req.header("x-request-id") ?? createId("bridge_auth_req");
    try {
      const response = await invokeValidateToken({
        requestId,
        token
      });

      if (response.response.code !== 0 || !response.valid || !response.userId || response.userId === "0") {
        res.status(statusForUserCode(response.response.code || 3001)).json({
          ok: false,
          error: {
            code: userCodeToString(response.response.code || 3001),
            message: response.response.message || "Token is invalid."
          }
        });
        return;
      }

      req.auth = {
        userId: String(response.userId),
        token
      };
      next();
    } catch (error) {
      logger.warn("UserService.ValidateToken failed.", { detail: error });
      res.status(502).json({
        ok: false,
        error: {
          code: "USER_SERVICE_UNAVAILABLE",
          message: error instanceof Error ? error.message : "UserService.ValidateToken failed."
        }
      });
    }
  };
}

export function authUserId(req: Request) {
  if (!req.auth?.userId) {
    throw new Error("Bridge authentication context is missing.");
  }
  return req.auth.userId;
}

function bearerToken(req: Request) {
  const header = req.header("authorization");
  if (!header) return "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? "";
}

function sendUnauthorized(res: Response, code: string, message: string) {
  res.status(401).json({
    ok: false,
    error: {
      code,
      message
    }
  });
}
