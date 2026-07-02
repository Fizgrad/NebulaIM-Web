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

type SendMessageResponse = {
  response: CommonResponse;
  messageId: string;
  serverTimestamp: string | number;
};

type MessageUnary<TResponse> = (
  request: Record<string, unknown>,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type MessageGrpcClient = grpc.Client & {
  SendSingleMessage: MessageUnary<SendMessageResponse>;
  SendGroupMessage: MessageUnary<SendMessageResponse>;
  AckMessage: MessageUnary<{ response: CommonResponse }>;
};

type MessageMethod = "SendSingleMessage" | "SendGroupMessage" | "AckMessage";

type MessageServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => MessageGrpcClient;

const numericIdSchema = z.string().regex(/^\d+$/, "ID must be numeric.");

const sendSingleSchema = z.object({
  fromUserId: numericIdSchema,
  toUserId: numericIdSchema,
  content: z.string().trim().min(1, "Message content is required.").max(4096, "Message content is too long."),
  clientSequenceId: z.coerce.number().int().min(0).max(999999).optional().default(0)
});

const sendGroupSchema = z.object({
  fromUserId: numericIdSchema,
  groupId: numericIdSchema,
  content: z.string().trim().min(1, "Message content is required.").max(4096, "Message content is too long."),
  clientSequenceId: z.coerce.number().int().min(0).max(999999).optional().default(0)
});

let cachedClient: MessageGrpcClient | null = null;

export function createMessageRouter(): Router {
  const router = express.Router();

  router.post("/single", async (req, res) => {
    const parsed = sendSingleSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid message payload.");
      return;
    }

    try {
      const response = await invokeMessage<SendMessageResponse>("SendSingleMessage", {
        requestId: requestId(req, "send_single_req"),
        fromUserId: Number(parsed.data.fromUserId),
        toUserId: Number(parsed.data.toUserId),
        contentType: "MESSAGE_CONTENT_TYPE_TEXT",
        content: parsed.data.content,
        clientSequenceId: parsed.data.clientSequenceId
      });

      if (!isOk(response.response)) {
        sendMessageError(res, response.response);
        return;
      }

      res.json({
        ok: true,
        messageId: response.messageId,
        serverTimestamp: response.serverTimestamp,
        response: response.response
      });
    } catch (error) {
      sendRpcError(res, "MessageService.SendSingleMessage failed.", error);
    }
  });

  router.post("/group", async (req, res) => {
    const parsed = sendGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid group message payload.");
      return;
    }

    try {
      const response = await invokeMessage<SendMessageResponse>("SendGroupMessage", {
        requestId: requestId(req, "send_group_req"),
        fromUserId: Number(parsed.data.fromUserId),
        groupId: Number(parsed.data.groupId),
        contentType: "MESSAGE_CONTENT_TYPE_TEXT",
        content: parsed.data.content,
        clientSequenceId: parsed.data.clientSequenceId
      });

      if (!isOk(response.response)) {
        sendMessageError(res, response.response);
        return;
      }

      res.json({
        ok: true,
        messageId: response.messageId,
        serverTimestamp: response.serverTimestamp,
        response: response.response
      });
    } catch (error) {
      sendRpcError(res, "MessageService.SendGroupMessage failed.", error);
    }
  });

  return router;
}

function invokeMessage<TResponse>(method: MessageMethod, request: Record<string, unknown>) {
  return new Promise<TResponse>((resolve, reject) => {
    getMessageClient()[method](request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response as TResponse);
    });
  });
}

function getMessageClient(): MessageGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "message.proto"), {
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
  const MessageService = proto?.MessageService as MessageServiceConstructor | undefined;
  if (!MessageService) {
    throw new Error("Failed to load nebula.proto.MessageService from message.proto.");
  }

  cachedClient = new MessageService(
    `${config.messageServiceHost}:${config.messageServicePort}`,
    grpc.credentials.createInsecure()
  );
  return cachedClient;
}

function requestId(req: express.Request, prefix: string) {
  return req.header("x-request-id") ?? createId(prefix);
}

function isOk(response: CommonResponse) {
  return response.code === 0;
}

function sendValidationError(res: express.Response, message: string) {
  res.status(400).json({
    ok: false,
    error: {
      code: "INVALID_MESSAGE_PAYLOAD",
      message
    }
  });
}

function sendMessageError(res: express.Response, response: CommonResponse) {
  res.status(statusForMessageCode(response.code)).json({
    ok: false,
    error: {
      code: messageCodeToString(response.code),
      message: response.message || "MessageService request failed."
    }
  });
}

function sendRpcError(res: express.Response, message: string, error: unknown) {
  logger.warn(message, { detail: error });
  res.status(502).json({
    ok: false,
    error: {
      code: "MESSAGE_SERVICE_UNAVAILABLE",
      message: error instanceof Error ? error.message : message
    }
  });
}

function statusForMessageCode(code: number) {
  if (code === 1001) return 400;
  if (code === 1005) return 404;
  if (code === 1006) return 403;
  if (code === 3001 || code === 3002 || code === 3003) return 502;
  return 400;
}

function messageCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    1005: "USER_NOT_FOUND",
    1006: "PERMISSION_DENIED",
    3001: "MESSAGE_PERSIST_FAILED",
    3002: "MESSAGE_KAFKA_FAILED",
    3003: "MESSAGE_REDIS_FAILED"
  };
  return names[code] ?? `MESSAGE_SERVICE_ERROR_${code}`;
}
