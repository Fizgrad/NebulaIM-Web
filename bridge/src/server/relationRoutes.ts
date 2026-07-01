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

type UserInfo = {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  createdAt: string | number;
};

type ListFriendsResponse = {
  response: CommonResponse;
  friends: UserInfo[];
};

type FriendRequestInfo = {
  friendRequestId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: number;
  createdAt: string | number;
  updatedAt: string | number;
};

type SendFriendRequestResponse = {
  response: CommonResponse;
  friendRequestId: string;
};

type ListFriendRequestsResponse = {
  response: CommonResponse;
  requests: FriendRequestInfo[];
};

type CreateGroupResponse = {
  response: CommonResponse;
  groupId: string;
};

type ListGroupMembersResponse = {
  response: CommonResponse;
  members: UserInfo[];
};

type RelationUnary<TResponse> = (
  request: Record<string, unknown>,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type RelationGrpcClient = grpc.Client & {
  AddFriend: RelationUnary<CommonResponse>;
  DeleteFriend: RelationUnary<CommonResponse>;
  ListFriends: RelationUnary<ListFriendsResponse>;
  SendFriendRequest: RelationUnary<SendFriendRequestResponse>;
  AcceptFriendRequest: RelationUnary<CommonResponse>;
  RejectFriendRequest: RelationUnary<CommonResponse>;
  ListFriendRequests: RelationUnary<ListFriendRequestsResponse>;
  CreateGroup: RelationUnary<CreateGroupResponse>;
  JoinGroup: RelationUnary<CommonResponse>;
  LeaveGroup: RelationUnary<CommonResponse>;
  ListGroupMembers: RelationUnary<ListGroupMembersResponse>;
};

type RelationMethod =
  | "AddFriend"
  | "DeleteFriend"
  | "ListFriends"
  | "SendFriendRequest"
  | "AcceptFriendRequest"
  | "RejectFriendRequest"
  | "ListFriendRequests"
  | "CreateGroup"
  | "JoinGroup"
  | "LeaveGroup"
  | "ListGroupMembers";

type RelationServiceConstructor = new (address: string, credentials: grpc.ChannelCredentials) => RelationGrpcClient;

const numericIdSchema = z.string().regex(/^\d+$/, "ID must be numeric.");

const userIdQuerySchema = z.object({
  userId: numericIdSchema
});

const addFriendSchema = z.object({
  userId: numericIdSchema,
  friendId: numericIdSchema
});

const sendFriendRequestSchema = z.object({
  fromUserId: numericIdSchema,
  toUserId: numericIdSchema,
  message: z.string().trim().max(255, "Request message is too long.").optional().default("")
});

const listFriendRequestsSchema = z.object({
  userId: numericIdSchema,
  incoming: z
    .preprocess((value) => {
      if (value === undefined) return true;
      if (value === true || value === "true" || value === "1") return true;
      if (value === false || value === "false" || value === "0") return false;
      return value;
    }, z.boolean())
    .default(true),
  status: z.coerce.number().int().min(0).max(3).default(0),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
});

const friendRequestActionSchema = z.object({
  userId: numericIdSchema
});

const createGroupSchema = z.object({
  ownerId: numericIdSchema,
  name: z.string().trim().min(1, "Group name is required.").max(128, "Group name is too long.")
});

const userActionSchema = z.object({
  userId: numericIdSchema
});

let cachedClient: RelationGrpcClient | null = null;

export function createRelationRouter(): Router {
  const router = express.Router();

  router.get("/friends", async (req, res) => {
    const parsed = userIdQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid user id.");
      return;
    }

    try {
      const response = await invokeRelation<ListFriendsResponse>("ListFriends", {
        requestId: requestId(req),
        userId: Number(parsed.data.userId)
      });

      if (!isOk(response.response)) {
        sendRelationError(res, response.response);
        return;
      }

      res.json({ ok: true, friends: response.friends ?? [] });
    } catch (error) {
      sendRpcError(res, "RelationService.ListFriends failed.", error);
    }
  });

  router.get("/friend-requests", async (req, res) => {
    const parsed = listFriendRequestsSchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid friend request query.");
      return;
    }

    try {
      const response = await invokeRelation<ListFriendRequestsResponse>("ListFriendRequests", {
        requestId: requestId(req),
        userId: Number(parsed.data.userId),
        incoming: parsed.data.incoming,
        status: parsed.data.status,
        page: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize
        }
      });

      if (!isOk(response.response)) {
        sendRelationError(res, response.response);
        return;
      }

      res.json({ ok: true, requests: response.requests ?? [], response: response.response });
    } catch (error) {
      sendRpcError(res, "RelationService.ListFriendRequests failed.", error);
    }
  });

  router.post("/friend-requests", async (req, res) => {
    const parsed = sendFriendRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid friend request payload.");
      return;
    }

    try {
      const response = await invokeRelation<SendFriendRequestResponse>("SendFriendRequest", {
        requestId: requestId(req),
        fromUserId: Number(parsed.data.fromUserId),
        toUserId: Number(parsed.data.toUserId),
        message: parsed.data.message
      });

      if (!isOk(response.response)) {
        sendRelationError(res, response.response);
        return;
      }

      res.json({ ok: true, friendRequestId: response.friendRequestId, response: response.response });
    } catch (error) {
      sendRpcError(res, "RelationService.SendFriendRequest failed.", error);
    }
  });

  router.post("/friend-requests/:requestId/accept", async (req, res) => {
    await handleFriendRequestAction(req, res, "AcceptFriendRequest");
  });

  router.post("/friend-requests/:requestId/reject", async (req, res) => {
    await handleFriendRequestAction(req, res, "RejectFriendRequest");
  });

  router.post("/friends", async (req, res) => {
    const parsed = addFriendSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid add friend payload.");
      return;
    }

    try {
      const response = await invokeRelation<CommonResponse>("AddFriend", {
        requestId: requestId(req),
        userId: Number(parsed.data.userId),
        friendId: Number(parsed.data.friendId)
      });

      if (!isOk(response)) {
        sendRelationError(res, response);
        return;
      }

      res.json({ ok: true, response });
    } catch (error) {
      sendRpcError(res, "RelationService.AddFriend failed.", error);
    }
  });

  router.delete("/friends/:friendId", async (req, res) => {
    const parsedUser = userIdQuerySchema.safeParse(req.query);
    const parsedFriend = numericIdSchema.safeParse(req.params.friendId);
    if (!parsedUser.success || !parsedFriend.success) {
      sendValidationError(res, "User ID and friend ID must be numeric.");
      return;
    }

    try {
      const response = await invokeRelation<CommonResponse>("DeleteFriend", {
        requestId: requestId(req),
        userId: Number(parsedUser.data.userId),
        friendId: Number(parsedFriend.data)
      });

      if (!isOk(response)) {
        sendRelationError(res, response);
        return;
      }

      res.json({ ok: true, response });
    } catch (error) {
      sendRpcError(res, "RelationService.DeleteFriend failed.", error);
    }
  });

  router.post("/groups", async (req, res) => {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message ?? "Invalid create group payload.");
      return;
    }

    try {
      const response = await invokeRelation<CreateGroupResponse>("CreateGroup", {
        requestId: requestId(req),
        ownerId: Number(parsed.data.ownerId),
        groupName: parsed.data.name
      });

      if (!isOk(response.response)) {
        sendRelationError(res, response.response);
        return;
      }

      res.json({ ok: true, groupId: response.groupId, response: response.response });
    } catch (error) {
      sendRpcError(res, "RelationService.CreateGroup failed.", error);
    }
  });

  router.post("/groups/:groupId/join", async (req, res) => {
    await handleGroupUserAction(req, res, "JoinGroup");
  });

  router.post("/groups/:groupId/leave", async (req, res) => {
    await handleGroupUserAction(req, res, "LeaveGroup");
  });

  router.get("/groups/:groupId/members", async (req, res) => {
    const parsedGroup = numericIdSchema.safeParse(req.params.groupId);
    if (!parsedGroup.success) {
      sendValidationError(res, "Group ID must be numeric.");
      return;
    }

    try {
      const response = await invokeRelation<ListGroupMembersResponse>("ListGroupMembers", {
        requestId: requestId(req),
        groupId: Number(parsedGroup.data)
      });

      if (!isOk(response.response)) {
        sendRelationError(res, response.response);
        return;
      }

      res.json({ ok: true, members: response.members ?? [] });
    } catch (error) {
      sendRpcError(res, "RelationService.ListGroupMembers failed.", error);
    }
  });

  return router;
}

async function handleFriendRequestAction(req: express.Request, res: express.Response, method: "AcceptFriendRequest" | "RejectFriendRequest") {
  const parsedRequest = numericIdSchema.safeParse(req.params.requestId);
  const parsedBody = friendRequestActionSchema.safeParse(req.body);
  if (!parsedRequest.success || !parsedBody.success) {
    sendValidationError(res, "User ID and friend request ID must be numeric.");
    return;
  }

  try {
    const response = await invokeRelation<CommonResponse>(method, {
      requestId: requestId(req),
      userId: Number(parsedBody.data.userId),
      friendRequestId: Number(parsedRequest.data)
    });

    if (!isOk(response)) {
      sendRelationError(res, response);
      return;
    }

    res.json({ ok: true, response });
  } catch (error) {
    sendRpcError(res, `RelationService.${method} failed.`, error);
  }
}

async function handleGroupUserAction(req: express.Request, res: express.Response, method: "JoinGroup" | "LeaveGroup") {
  const parsedGroup = numericIdSchema.safeParse(req.params.groupId);
  const parsedBody = userActionSchema.safeParse(req.body);
  if (!parsedGroup.success || !parsedBody.success) {
    sendValidationError(res, "User ID and group ID must be numeric.");
    return;
  }

  try {
    const response = await invokeRelation<CommonResponse>(method, {
      requestId: requestId(req),
      userId: Number(parsedBody.data.userId),
      groupId: Number(parsedGroup.data)
    });

    if (!isOk(response)) {
      sendRelationError(res, response);
      return;
    }

    res.json({ ok: true, response });
  } catch (error) {
    sendRpcError(res, `RelationService.${method} failed.`, error);
  }
}

function invokeRelation<TResponse>(method: RelationMethod, request: Record<string, unknown>) {
  return new Promise<TResponse>((resolve, reject) => {
    getRelationClient()[method](request, { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response as TResponse);
    });
  });
}

function getRelationClient(): RelationGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "relation.proto"), {
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
  const RelationService = proto?.RelationService as RelationServiceConstructor | undefined;
  if (!RelationService) {
    throw new Error("Failed to load nebula.proto.RelationService from relation.proto.");
  }

  cachedClient = new RelationService(
    `${config.relationServiceHost}:${config.relationServicePort}`,
    grpc.credentials.createInsecure()
  );
  return cachedClient;
}

function requestId(req: express.Request) {
  return req.header("x-request-id") ?? createId("relation_req");
}

function isOk(response: CommonResponse) {
  return response.code === 0;
}

function sendValidationError(res: express.Response, message: string) {
  res.status(400).json({
    ok: false,
    error: {
      code: "INVALID_RELATION_PAYLOAD",
      message
    }
  });
}

function sendRelationError(res: express.Response, response: CommonResponse) {
  res.status(statusForRelationCode(response.code)).json({
    ok: false,
    error: {
      code: relationCodeToString(response.code),
      message: response.message || "RelationService request failed."
    }
  });
}

function sendRpcError(res: express.Response, message: string, error: unknown) {
  logger.warn(message, { detail: error });
  res.status(502).json({
    ok: false,
    error: {
      code: "RELATION_SERVICE_UNAVAILABLE",
      message: error instanceof Error ? error.message : message
    }
  });
}

function statusForRelationCode(code: number) {
  if ([1001, 7003, 7104, 7105, 10007, 12004].includes(code)) return 400;
  if ([3002, 7002, 7101, 7103, 12001].includes(code)) return 404;
  if ([7001, 7102, 12002, 12003].includes(code)) return 409;
  return 502;
}

function relationCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    3002: "USER_NOT_FOUND",
    7001: "FRIEND_ALREADY_EXISTS",
    7002: "FRIEND_NOT_FOUND",
    7003: "CANNOT_ADD_SELF",
    7101: "GROUP_NOT_FOUND",
    7102: "GROUP_ALREADY_JOINED",
    7103: "GROUP_NOT_MEMBER",
    7104: "GROUP_OWNER_CANNOT_LEAVE",
    7105: "GROUP_PERMISSION_DENIED",
    10007: "GATEWAY_PERMISSION_DENIED",
    12001: "FRIEND_REQUEST_NOT_FOUND",
    12002: "FRIEND_REQUEST_ALREADY_EXISTS",
    12003: "FRIEND_REQUEST_ALREADY_HANDLED",
    12004: "FRIEND_REQUEST_REQUIRED"
  };
  return names[code] ?? `RELATION_SERVICE_ERROR_${code}`;
}
