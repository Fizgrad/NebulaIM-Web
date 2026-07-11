import type { Router } from "express";
import express from "express";
import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { type RowDataPacket } from "mysql2/promise";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { getMysqlPool } from "./mysqlPool.js";

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
  MarkConversationRead: MessageUnary<CommonResponse>;
  GetMessageReadState: MessageUnary<GetMessageReadStateResponse>;
};

type MessageMethod = "SendSingleMessage" | "SendGroupMessage" | "AckMessage" | "MarkConversationRead" | "GetMessageReadState";

type MessageReadStateRow = {
  messageId: string | number;
  userId: string | number;
  deliveredAt: string | number;
  readAt: string | number;
};

type GetMessageReadStateResponse = {
  response: CommonResponse;
  states: MessageReadStateRow[];
};

type MessageServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => MessageGrpcClient;

const numericIdSchema = z.string().regex(/^\d+$/, "ID must be numeric.");
const historyQuerySchema = z.object({
  userId: numericIdSchema,
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

const readStateQuerySchema = z.object({
  messageIds: z
    .string()
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
    .pipe(z.array(numericIdSchema).min(1, "At least one message ID is required.").max(100, "Too many message IDs."))
});

const sendSingleSchema = z.object({
  fromUserId: numericIdSchema,
  toUserId: numericIdSchema,
  contentType: z.enum(["text", "image", "MESSAGE_CONTENT_TYPE_TEXT", "MESSAGE_CONTENT_TYPE_IMAGE"]).optional().default("text"),
  content: z.string().trim().min(1, "Message content is required.").max(4096, "Message content is too long."),
  clientSequenceId: z.coerce.number().int().min(0).max(999999).optional().default(0)
});

const sendGroupSchema = z.object({
  fromUserId: numericIdSchema,
  groupId: numericIdSchema,
  contentType: z.enum(["text", "image", "MESSAGE_CONTENT_TYPE_TEXT", "MESSAGE_CONTENT_TYPE_IMAGE"]).optional().default("text"),
  content: z.string().trim().min(1, "Message content is required.").max(4096, "Message content is too long."),
  clientSequenceId: z.coerce.number().int().min(0).max(999999).optional().default(0)
});

let cachedClient: MessageGrpcClient | null = null;

type MessageRow = RowDataPacket & {
  message_id: string;
  conversation_id: string;
  from_user_id: string;
  to_user_id: string;
  group_id: string;
  message_type: number;
  content: string;
  status: number;
  recalled: number;
  recalled_at: string;
  created_at: string;
};

export function createMessageRouter(): Router {
  const router = express.Router();

  router.get("/conversations/:conversationId", async (req, res) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    const conversationId = String(req.params.conversationId ?? "");
    if (!numericIdSchema.safeParse(conversationId).success || !parsed.success) {
      sendValidationError(res, parsed.success ? "Conversation ID must be numeric." : parsed.error.issues[0]?.message ?? "Invalid message history query.");
      return;
    }

    try {
      const pool = getMysqlPool();
      const [conversationRows] = await pool.execute<RowDataPacket[]>(
        "SELECT conversation_id FROM conversations WHERE conversation_id = ? AND owner_user_id = ? AND deleted = 0 LIMIT 1",
        [conversationId, parsed.data.userId]
      );
      if (conversationRows.length === 0) {
        res.status(404).json({
          ok: false,
          error: {
            code: "CONVERSATION_NOT_FOUND",
            message: "Conversation is not available for this user."
          }
        });
        return;
      }

      const before = parsed.data.before ?? Date.now();
      const limit = parsed.data.limit;
      const [rows] = await pool.execute<MessageRow[]>(
        `SELECT message_id, conversation_id, from_user_id, to_user_id, group_id, message_type, content, status, recalled, recalled_at, created_at
         FROM messages
         WHERE conversation_id = ? AND created_at <= ?
         ORDER BY created_at DESC, message_id DESC
         LIMIT ${limit}`,
        [conversationId, before]
      );

      res.json({
        ok: true,
        messages: rows.reverse().map(toBridgeMessage)
      });
    } catch (error) {
      sendHistoryError(res, error);
    }
  });

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
        contentType: toProtoContentType(parsed.data.contentType),
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
        contentType: toProtoContentType(parsed.data.contentType),
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

  router.get("/read-state", async (req, res) => {
    const parsed = readStateQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid read-state query.");
      return;
    }

    const results = await Promise.all(
      parsed.data.messageIds.map(async (messageId) => {
        try {
          const response = await invokeMessage<GetMessageReadStateResponse>("GetMessageReadState", {
            requestId: requestId(req, "read_state_req"),
            messageId: Number(messageId)
          });
          if (!isOk(response.response)) {
            return { messageId, states: [] };
          }
          return {
            messageId,
            states: (response.states ?? []).map((state) => ({
              userId: String(state.userId),
              deliveredAt: Number(state.deliveredAt ?? 0),
              readAt: Number(state.readAt ?? 0)
            }))
          };
        } catch (error) {
          logger.warn("MessageService.GetMessageReadState failed.", { detail: error });
          return { messageId, states: [] };
        }
      })
    );

    res.json({ ok: true, items: results });
  });

  return router;
}

export async function markMessageConversationRead(userId: string, conversationId: string, requestIdValue: string): Promise<CommonResponse> {
  return invokeMessage<CommonResponse>("MarkConversationRead", {
    requestId: requestIdValue,
    userId: Number(userId),
    conversationId: Number(conversationId)
  });
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

function toBridgeMessage(row: MessageRow) {
  return {
    messageId: String(row.message_id),
    conversationId: String(row.conversation_id),
    fromUserId: String(row.from_user_id),
    toUserId: String(row.to_user_id),
    groupId: String(row.group_id),
    contentType: row.message_type,
    content: row.content,
    status: row.status,
    recalled: Boolean(row.recalled),
    recalledAt: String(row.recalled_at ?? "0"),
    createdAt: String(row.created_at)
  };
}

function requestId(req: express.Request, prefix: string) {
  return req.header("x-request-id") ?? createId(prefix);
}

function isOk(response: CommonResponse) {
  return response.code === 0;
}

function toProtoContentType(contentType: string) {
  return contentType === "image" || contentType === "MESSAGE_CONTENT_TYPE_IMAGE"
    ? "MESSAGE_CONTENT_TYPE_IMAGE"
    : "MESSAGE_CONTENT_TYPE_TEXT";
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

function sendHistoryError(res: express.Response, error: unknown) {
  logger.warn("Message history query failed.", { detail: error });
  res.status(503).json({
    ok: false,
    error: {
      code: "MESSAGE_HISTORY_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Message history is unavailable."
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
