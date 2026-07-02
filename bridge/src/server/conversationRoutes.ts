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
import { getMysqlPool, hasMysqlConfig } from "./mysqlPool.js";
import { markMessageConversationRead } from "./messageRoutes.js";

type CommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

type ConversationInfo = {
  conversationId: string;
  conversationType: number;
  ownerUserId: string;
  peerUserId: string;
  groupId: string;
  groupName?: string;
  lastMessageId: string;
  lastMessagePreview: string;
  lastMessageAt: string | number;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  deleted: boolean;
  updatedAt: string | number;
};

type ListConversationsResponse = {
  response: CommonResponse;
  conversations: ConversationInfo[];
};

type GroupNameRow = RowDataPacket & {
  id: string;
  group_name: string;
};

type UnreadCountRow = RowDataPacket & {
  conversation_id: string;
  unread_count: number;
};

type ConversationUnary<TResponse> = (
  request: Record<string, unknown>,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type ConversationGrpcClient = grpc.Client & {
  ListConversations: ConversationUnary<ListConversationsResponse>;
  MarkConversationRead: ConversationUnary<CommonResponse>;
  DeleteConversation: ConversationUnary<CommonResponse>;
  PinConversation: ConversationUnary<CommonResponse>;
  MuteConversation: ConversationUnary<CommonResponse>;
};

type ConversationMethod =
  | "ListConversations"
  | "MarkConversationRead"
  | "DeleteConversation"
  | "PinConversation"
  | "MuteConversation";

type ConversationServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => ConversationGrpcClient;

const numericIdSchema = z.string().regex(/^\d+$/, "ID must be numeric.");

const listSchema = z.object({
  userId: numericIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

const conversationActionSchema = z.object({
  userId: numericIdSchema
});

const flagSchema = conversationActionSchema.extend({
  value: z.boolean()
});

let cachedClient: ConversationGrpcClient | null = null;

export function createConversationRouter(): Router {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid list conversations payload.");
      return;
    }

    try {
      const response = await invokeConversation<ListConversationsResponse>("ListConversations", {
        requestId: requestId(req),
        userId: Number(parsed.data.userId),
        page: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize
        }
      });

      if (!isOk(response.response)) {
        sendConversationError(res, response.response);
        return;
      }

      const conversations = await enrichConversations(response.conversations ?? [], parsed.data.userId);
      res.json({ ok: true, conversations, response: response.response });
    } catch (error) {
      sendRpcError(res, "ConversationService.ListConversations failed.", error);
    }
  });

  router.post("/:conversationId/read", async (req, res) => {
    await handleMarkConversationRead(req, res);
  });

  router.delete("/:conversationId", async (req, res) => {
    await handleConversationAction(req, res, "DeleteConversation", {});
  });

  router.post("/:conversationId/pin", async (req, res) => {
    const parsed = flagSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid pin payload.");
      return;
    }
    await handleConversationAction(req, res, "PinConversation", { pinned: parsed.data.value }, parsed.data.userId);
  });

  router.post("/:conversationId/mute", async (req, res) => {
    const parsed = flagSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid mute payload.");
      return;
    }
    await handleConversationAction(req, res, "MuteConversation", { muted: parsed.data.value }, parsed.data.userId);
  });

  return router;
}

async function handleMarkConversationRead(req: express.Request, res: express.Response) {
  const parsedConversation = numericIdSchema.safeParse(req.params.conversationId);
  const parsedBody = conversationActionSchema.safeParse(req.body);
  if (!parsedConversation.success || !parsedBody.success) {
    sendValidationError(res, "User ID and conversation ID must be numeric.");
    return;
  }

  try {
    const response = await markMessageConversationRead(parsedBody.data.userId, parsedConversation.data, requestId(req));

    if (!isOk(response)) {
      sendConversationError(res, response);
      return;
    }

    await persistConversationRead(parsedBody.data.userId, parsedConversation.data);
    res.json({ ok: true, response });
  } catch (error) {
    sendRpcError(res, "MessageService.MarkConversationRead failed.", error);
  }
}

async function persistConversationRead(userId: string, conversationId: string) {
  if (!hasMysqlConfig()) return;

  const readAt = Date.now();
  const pool = getMysqlPool();
  await pool.execute(
    `INSERT INTO message_receipts(message_id,user_id,delivered_at,read_at,created_at,updated_at)
     SELECT m.message_id, ?, ?, ?, ?, ?
     FROM messages m
     WHERE m.conversation_id = ?
       AND m.from_user_id <> ?
       AND m.recalled = 0
     ON DUPLICATE KEY UPDATE
       delivered_at=GREATEST(delivered_at,VALUES(delivered_at)),
       read_at=GREATEST(read_at,VALUES(read_at)),
       updated_at=VALUES(updated_at)`,
    [userId, readAt, readAt, readAt, readAt, conversationId, userId]
  );
  await pool.execute(
    "UPDATE conversations SET unread_count = 0, updated_at = GREATEST(updated_at, ?) WHERE conversation_id = ? AND owner_user_id = ?",
    [readAt, conversationId, userId]
  );
}

async function handleConversationAction(
  req: express.Request,
  res: express.Response,
  method: Exclude<ConversationMethod, "ListConversations">,
  extra: Record<string, unknown>,
  parsedUserId?: string
) {
  const parsedConversation = numericIdSchema.safeParse(req.params.conversationId);
  const parsedBody = parsedUserId ? { success: true as const, data: { userId: parsedUserId } } : conversationActionSchema.safeParse(req.body);
  if (!parsedConversation.success || !parsedBody.success) {
    sendValidationError(res, "User ID and conversation ID must be numeric.");
    return;
  }

  try {
    const response = await invokeConversation<CommonResponse>(method, {
      requestId: requestId(req),
      userId: Number(parsedBody.data.userId),
      conversationId: Number(parsedConversation.data),
      ...extra
    });

    if (!isOk(response)) {
      sendConversationError(res, response);
      return;
    }

    res.json({ ok: true, response });
  } catch (error) {
    sendRpcError(res, `ConversationService.${method} failed.`, error);
  }
}

async function enrichConversations(conversations: ConversationInfo[], userId: string) {
  const [withGroupNames, unreadCounts] = await Promise.all([
    attachGroupNames(conversations),
    calculateUnreadCounts(conversations, userId)
  ]);
  return withGroupNames.map((conversation) => ({
    ...conversation,
    unreadCount: Number(conversation.unreadCount ?? 0) <= 0 ? 0 : unreadCounts.get(String(conversation.conversationId)) ?? 0
  }));
}

async function attachGroupNames(conversations: ConversationInfo[]) {
  const groupIds = Array.from(
    new Set(
      conversations
        .map((conversation) => String(conversation.groupId ?? ""))
        .filter((groupId) => groupId !== "" && groupId !== "0" && numericIdSchema.safeParse(groupId).success)
    )
  );
  if (groupIds.length === 0 || !hasMysqlConfig()) return conversations;

  try {
    const placeholders = groupIds.map(() => "?").join(",");
    const [rows] = await getMysqlPool().execute<GroupNameRow[]>(
      `SELECT id, group_name FROM \`groups\` WHERE id IN (${placeholders})`,
      groupIds
    );
    const namesById = new Map(rows.map((row) => [String(row.id), row.group_name]));
    return conversations.map((conversation) => ({
      ...conversation,
      groupName: namesById.get(String(conversation.groupId)) ?? conversation.groupName
    }));
  } catch (error) {
    logger.warn("Conversation group name lookup failed.", { detail: error });
    return conversations;
  }
}

async function calculateUnreadCounts(conversations: ConversationInfo[], userId: string) {
  const conversationIds = Array.from(
    new Set(
      conversations
        .map((conversation) => String(conversation.conversationId ?? ""))
        .filter((conversationId) => conversationId !== "" && numericIdSchema.safeParse(conversationId).success)
    )
  );
  const counts = new Map<string, number>();
  if (conversationIds.length === 0 || !hasMysqlConfig()) return counts;

  try {
    const placeholders = conversationIds.map(() => "?").join(",");
    const [rows] = await getMysqlPool().execute<UnreadCountRow[]>(
      `SELECT m.conversation_id, COUNT(*) AS unread_count
       FROM messages m
       LEFT JOIN message_receipts r ON r.message_id = m.message_id AND r.user_id = ?
       WHERE m.conversation_id IN (${placeholders})
         AND m.from_user_id <> ?
         AND m.recalled = 0
         AND COALESCE(r.read_at, 0) = 0
       GROUP BY m.conversation_id`,
      [userId, ...conversationIds, userId]
    );
    rows.forEach((row) => counts.set(String(row.conversation_id), Number(row.unread_count ?? 0)));
  } catch (error) {
    logger.warn("Conversation unread count lookup failed.", { detail: error });
    conversations.forEach((conversation) => counts.set(String(conversation.conversationId), Number(conversation.unreadCount ?? 0)));
  }
  return counts;
}

function invokeConversation<TResponse>(method: ConversationMethod, request: Record<string, unknown>) {
  return new Promise<TResponse>((resolve, reject) => {
    getConversationClient()[method](request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response as TResponse);
    });
  });
}

function getConversationClient(): ConversationGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "conversation.proto"), {
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
  const ConversationService = proto?.ConversationService as ConversationServiceConstructor | undefined;
  if (!ConversationService) {
    throw new Error("Failed to load nebula.proto.ConversationService from conversation.proto.");
  }

  cachedClient = new ConversationService(
    `${config.conversationServiceHost}:${config.conversationServicePort}`,
    grpc.credentials.createInsecure()
  );
  return cachedClient;
}

function requestId(req: express.Request) {
  return req.header("x-request-id") ?? createId("conversation_req");
}

function isOk(response: CommonResponse) {
  return response.code === 0;
}

function sendValidationError(res: express.Response, message: string) {
  res.status(400).json({
    ok: false,
    error: {
      code: "INVALID_CONVERSATION_PAYLOAD",
      message
    }
  });
}

function sendConversationError(res: express.Response, response: CommonResponse) {
  res.status(statusForConversationCode(response.code)).json({
    ok: false,
    error: {
      code: conversationCodeToString(response.code),
      message: response.message || "ConversationService request failed."
    }
  });
}

function sendRpcError(res: express.Response, message: string, error: unknown) {
  logger.warn(message, { detail: error });
  res.status(502).json({
    ok: false,
    error: {
      code: "CONVERSATION_SERVICE_UNAVAILABLE",
      message: error instanceof Error ? error.message : message
    }
  });
}

function statusForConversationCode(code: number) {
  if (code === 1001) return 400;
  if (code === 13001) return 404;
  return 502;
}

function conversationCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    13001: "CONVERSATION_NOT_FOUND"
  };
  return names[code] ?? `CONVERSATION_SERVICE_ERROR_${code}`;
}
