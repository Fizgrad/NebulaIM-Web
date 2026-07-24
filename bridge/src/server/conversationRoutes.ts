import type { Router } from "express";
import express from "express";
import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { z } from "zod";
import { config } from "../config.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { internalMetadata } from "./grpcMetadata.js";
import { grpcChannelCredentials, grpcChannelOptions } from "./grpcCredentials.js";
import { markMessageConversationRead } from "./messageRoutes.js";
import { authUserId } from "./authMiddleware.js";

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

type ConversationUnary<TResponse> = (
  request: Record<string, unknown>,
  metadata: grpc.Metadata,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type ConversationGrpcClient = grpc.Client & {
  ListConversations: ConversationUnary<ListConversationsResponse>;
  DeleteConversation: ConversationUnary<CommonResponse>;
  PinConversation: ConversationUnary<CommonResponse>;
  MuteConversation: ConversationUnary<CommonResponse>;
};

type ConversationMethod =
  | "ListConversations"
  | "DeleteConversation"
  | "PinConversation"
  | "MuteConversation";

type ConversationServiceConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: grpc.ChannelOptions
) => ConversationGrpcClient;

const numericIdSchema = z.string().regex(/^\d+$/, "ID must be numeric.");

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

const flagSchema = z.object({
  value: z.boolean()
});

const readSchema = z.object({
  upToMessageId: numericIdSchema
});

let cachedClient: ConversationGrpcClient | null = null;

export function createConversationRouter(): Router {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const parsed = listSchema.safeParse(req.query);
    const userId = authUserId(req);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid list conversations payload.");
      return;
    }

    try {
      const response = await invokeConversation<ListConversationsResponse>("ListConversations", {
        requestId: requestId(req),
        userId,
        page: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize
        }
      });

      if (!isOk(response.response)) {
        sendConversationError(res, response.response);
        return;
      }

      res.json({ ok: true, conversations: response.conversations ?? [], response: response.response });
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
    await handleConversationAction(req, res, "PinConversation", { pinned: parsed.data.value });
  });

  router.post("/:conversationId/mute", async (req, res) => {
    const parsed = flagSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid mute payload.");
      return;
    }
    await handleConversationAction(req, res, "MuteConversation", { muted: parsed.data.value });
  });

  return router;
}

async function handleMarkConversationRead(req: express.Request, res: express.Response) {
  const parsedConversation = numericIdSchema.safeParse(req.params.conversationId);
  const parsedBody = readSchema.safeParse(req.body);
  const userId = authUserId(req);
  if (!parsedConversation.success || !parsedBody.success) {
    const message = !parsedConversation.success
      ? "Conversation ID must be numeric."
      : !parsedBody.success
        ? parsedBody.error.issues[0]?.message ?? "A valid read cursor is required."
        : "Invalid read request.";
    sendValidationError(res, message);
    return;
  }

  try {
    const response = await markMessageConversationRead(
      userId,
      parsedConversation.data,
      parsedBody.data.upToMessageId,
      requestId(req)
    );

    if (!isOk(response)) {
      sendConversationError(res, response);
      return;
    }

    res.json({ ok: true, response });
  } catch (error) {
    sendRpcError(res, "MessageService.MarkConversationRead failed.", error);
  }
}

async function handleConversationAction(
  req: express.Request,
  res: express.Response,
  method: Exclude<ConversationMethod, "ListConversations">,
  extra: Record<string, unknown>
) {
  const parsedConversation = numericIdSchema.safeParse(req.params.conversationId);
  const userId = authUserId(req);
  if (!parsedConversation.success) {
    sendValidationError(res, "Conversation ID must be numeric.");
    return;
  }

  try {
    const response = await invokeConversation<CommonResponse>(method, {
      requestId: requestId(req),
      userId,
      conversationId: parsedConversation.data,
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

function invokeConversation<TResponse>(method: ConversationMethod, request: Record<string, unknown>) {
  return new Promise<TResponse>((resolve, reject) => {
    getConversationClient()[method](request, internalMetadata(), { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
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
    grpcChannelCredentials(),
    grpcChannelOptions()
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
