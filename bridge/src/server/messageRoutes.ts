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
import { internalMetadata } from "./grpcMetadata.js";
import { getMysqlPool } from "./mysqlPool.js";
import { authUserId } from "./authMiddleware.js";

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
  metadata: grpc.Metadata,
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
const maxUint32 = 4_294_967_295;
const historyQuerySchema = z.object({
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
  toUserId: numericIdSchema,
  contentType: z.enum(["text", "image", "MESSAGE_CONTENT_TYPE_TEXT", "MESSAGE_CONTENT_TYPE_IMAGE"]).optional().default("text"),
  content: z.string().trim().min(1, "Message content is required.").max(4096, "Message content is too long."),
  clientSequenceId: z.coerce.number().int().min(0).max(maxUint32).optional().default(0)
});

const sendGroupSchema = z.object({
  groupId: numericIdSchema,
  contentType: z.enum(["text", "image", "MESSAGE_CONTENT_TYPE_TEXT", "MESSAGE_CONTENT_TYPE_IMAGE"]).optional().default("text"),
  content: z.string().trim().min(1, "Message content is required.").max(4096, "Message content is too long."),
  clientSequenceId: z.coerce.number().int().min(0).max(maxUint32).optional().default(0)
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

type AuthorizedMessageRow = RowDataPacket & {
  message_id: string | number;
};

export function createMessageRouter(): Router {
  const router = express.Router();

  router.get("/conversations/:conversationId", async (req, res) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    const conversationId = String(req.params.conversationId ?? "");
    const userId = authUserId(req);
    if (!numericIdSchema.safeParse(conversationId).success || !parsed.success) {
      sendValidationError(res, parsed.success ? "Conversation ID must be numeric." : parsed.error.issues[0]?.message ?? "Invalid message history query.");
      return;
    }

    try {
      const pool = getMysqlPool();
      const [conversationRows] = await pool.execute<RowDataPacket[]>(
        "SELECT conversation_id FROM conversations WHERE conversation_id = ? AND owner_user_id = ? AND deleted = 0 LIMIT 1",
        [conversationId, userId]
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
    const fromUserId = authUserId(req);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid message payload.");
      return;
    }

    try {
      const response = await invokeMessage<SendMessageResponse>("SendSingleMessage", {
        requestId: requestId(req, "send_single_req"),
        fromUserId: Number(fromUserId),
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
    const fromUserId = authUserId(req);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid group message payload.");
      return;
    }

    try {
      const response = await invokeMessage<SendMessageResponse>("SendGroupMessage", {
        requestId: requestId(req, "send_group_req"),
        fromUserId: Number(fromUserId),
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
    const userId = authUserId(req);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid read-state query.");
      return;
    }

    let authorizedMessageIds: Set<string>;
    try {
      authorizedMessageIds = await listAuthorizedReadStateMessageIds(userId, parsed.data.messageIds);
    } catch (error) {
      sendReadStateError(res, error);
      return;
    }

    const results = await Promise.all(
      parsed.data.messageIds.map(async (messageId) => {
        if (!authorizedMessageIds.has(messageId)) {
          return { messageId, states: [] };
        }

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
    getMessageClient()[method](request, internalMetadata(), { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
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

async function listAuthorizedReadStateMessageIds(userId: string, messageIds: string[]) {
  const uniqueMessageIds = [...new Set(messageIds)];
  if (uniqueMessageIds.length === 0) return new Set<string>();

  const placeholders = uniqueMessageIds.map(() => "?").join(", ");
  const [rows] = await getMysqlPool().execute<AuthorizedMessageRow[]>(
    `SELECT DISTINCT m.message_id
     FROM messages m
     INNER JOIN conversations c ON c.conversation_id = m.conversation_id
     WHERE c.owner_user_id = ? AND c.deleted = 0 AND m.message_id IN (${placeholders})`,
    [userId, ...uniqueMessageIds]
  );
  return new Set(rows.map((row) => String(row.message_id)));
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

function sendReadStateError(res: express.Response, error: unknown) {
  logger.warn("Message read-state authorization query failed.", { detail: error });
  res.status(503).json({
    ok: false,
    error: {
      code: "MESSAGE_READ_STATE_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Message read state is unavailable."
    }
  });
}

function statusForMessageCode(code: number) {
  if ([1001, 8001, 8002, 8009, 14001, 14003].includes(code)) return 400;
  if ([3000, 3001, 3007].includes(code)) return 401;
  if ([8008, 10007, 14002, 7103].includes(code)) return 403;
  if ([3002, 7101, 8003, 13001].includes(code)) return 404;
  if (code === 11001) return 429;
  if ([4000, 5000, 6000, 8005, 8006, 8007, 11002, 16002].includes(code)) return 502;
  return 400;
}

function messageCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    3000: "AUTH_FAILED",
    3001: "TOKEN_INVALID",
    3002: "USER_NOT_FOUND",
    3007: "TOKEN_EXPIRED",
    4000: "DB_ERROR",
    5000: "REDIS_ERROR",
    6000: "KAFKA_ERROR",
    7101: "GROUP_NOT_FOUND",
    7103: "GROUP_NOT_MEMBER",
    8001: "MESSAGE_EMPTY",
    8002: "MESSAGE_TOO_LARGE",
    8003: "MESSAGE_NOT_FOUND",
    8005: "MESSAGE_PERSIST_FAILED",
    8006: "MESSAGE_KAFKA_FAILED",
    8007: "MESSAGE_ACK_FAILED",
    8008: "MESSAGE_PERMISSION_DENIED",
    8009: "INVALID_CONVERSATION",
    10007: "GATEWAY_PERMISSION_DENIED",
    11001: "RATE_LIMITED",
    11002: "SERVICE_UNAVAILABLE",
    13001: "CONVERSATION_NOT_FOUND",
    14001: "MESSAGE_RECALL_TIMEOUT",
    14002: "MESSAGE_RECALL_PERMISSION_DENIED",
    14003: "MESSAGE_ALREADY_RECALLED",
    16002: "OUTBOX_PUBLISH_FAILED"
  };
  return names[code] ?? `MESSAGE_SERVICE_ERROR_${code}`;
}
