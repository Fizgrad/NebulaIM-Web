import { z } from "zod";
import { BridgeError, toBridgeError } from "../errors/BridgeError.js";
import type { BridgeSession, ServerEvent } from "../types/bridge.js";
import type { ClientEvent } from "../types/clientEvents.js";
import { handleLogin } from "./authHandler.js";
import { handleHeartbeat } from "./heartbeatHandler.js";
import {
  handleAckMessage,
  handlePullOfflineMessages,
  handleSendGroupMessage,
  handleSendSingleMessage
} from "./chatHandler.js";

const baseSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.number(),
  payload: z.unknown()
});

const loginSchema = baseSchema.extend({
  type: z.literal("auth.login"),
  payload: z.object({
    username: z.string().min(1),
    password: z.string().min(1)
  })
});

const heartbeatSchema = baseSchema.extend({
  type: z.literal("connection.heartbeat"),
  payload: z.object({}).passthrough()
});

const sendSingleSchema = baseSchema.extend({
  type: z.literal("message.send_single"),
  payload: z.object({
    fromUserId: z.string().min(1),
    toUserId: z.string().min(1),
    content: z.string().min(1),
    contentType: z.literal("text"),
    clientSequenceId: z.number().int().nonnegative()
  })
});

const sendGroupSchema = baseSchema.extend({
  type: z.literal("message.send_group"),
  payload: z.object({
    fromUserId: z.string().min(1),
    groupId: z.string().min(1),
    content: z.string().min(1),
    contentType: z.literal("text"),
    clientSequenceId: z.number().int().nonnegative()
  })
});

const ackSchema = baseSchema.extend({
  type: z.literal("message.ack"),
  payload: z.object({
    userId: z.string().min(1),
    messageId: z.string().min(1)
  })
});

const pullOfflineSchema = baseSchema.extend({
  type: z.literal("message.pull_offline"),
  payload: z.object({
    userId: z.string().min(1),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100)
  })
});

export async function handleClientMessage(session: BridgeSession, rawEvent: unknown): Promise<ServerEvent> {
  const base = baseSchema.safeParse(rawEvent);
  const eventId = base.success ? base.data.id : "invalid";

  try {
    if (!base.success) {
      throw new BridgeError({
        code: "INVALID_EVENT",
        message: "Client event must include id, type, timestamp and payload.",
        detail: base.error.flatten()
      });
    }

    if (!session.gateway.isConnected()) {
      throw new BridgeError({
        code: "GATEWAY_NOT_CONNECTED",
        message: "Bridge is not connected to NebulaIM Gateway."
      });
    }

    switch (base.data.type) {
      case "auth.login":
        return await handleLogin(session, loginSchema.parse(rawEvent) as ClientEvent & { type: "auth.login" });
      case "connection.heartbeat":
        return await handleHeartbeat(session, heartbeatSchema.parse(rawEvent) as ClientEvent & { type: "connection.heartbeat" });
      case "message.send_single":
        return await handleSendSingleMessage(session, sendSingleSchema.parse(rawEvent) as ClientEvent & { type: "message.send_single" });
      case "message.send_group":
        return await handleSendGroupMessage(session, sendGroupSchema.parse(rawEvent) as ClientEvent & { type: "message.send_group" });
      case "message.ack":
        return await handleAckMessage(session, ackSchema.parse(rawEvent) as ClientEvent & { type: "message.ack" });
      case "message.pull_offline":
        return await handlePullOfflineMessages(session, pullOfflineSchema.parse(rawEvent) as ClientEvent & { type: "message.pull_offline" });
      default:
        throw new BridgeError({
          code: "INVALID_EVENT",
          message: `Unknown event type: ${base.data.type}`
        });
    }
  } catch (error) {
    const bridgeError = toBridgeError(error, {
      code: "INTERNAL_ERROR",
      message: "Bridge failed to handle client event."
    });
    return {
      id: eventId,
      type: "error",
      ok: false,
      timestamp: Date.now(),
      error: {
        code: errorCodeToHttpCode(bridgeError.code),
        message: bridgeError.message
      }
    };
  }
}

function errorCodeToHttpCode(code: BridgeError["code"]): number {
  switch (code) {
    case "INVALID_JSON":
    case "INVALID_EVENT":
      return 400;
    case "AUTH_FAILED":
      return 401;
    case "GATEWAY_NOT_CONNECTED":
      return 503;
    case "GATEWAY_TIMEOUT":
      return 504;
    default:
      return 500;
  }
}
