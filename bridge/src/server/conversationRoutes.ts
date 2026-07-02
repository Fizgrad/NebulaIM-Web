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

      const conversations = await attachGroupNames(response.conversations ?? []);
      res.json({ ok: true, conversations, response: response.response });
    } catch (error) {
      sendRpcError(res, "ConversationService.ListConversations failed.", error);
    }
  });

  router.post("/:conversationId/read", async (req, res) => {
    await handleConversationAction(req, res, "MarkConversationRead", {});
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
