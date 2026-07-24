import * as grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "node:path";
import { config } from "../config.js";
import { internalMetadata } from "./grpcMetadata.js";
import { grpcChannelCredentials, grpcChannelOptions } from "./grpcCredentials.js";

export type CommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

export type RegisterResponse = {
  response: CommonResponse;
  userId: string;
};

export type RefreshTokenResponse = {
  response: CommonResponse;
  userId: string;
  token: string;
  expireAt: string | number;
};

export type ValidateTokenResponse = {
  response: CommonResponse;
  valid: boolean;
  userId: string;
};

export type UserInfo = {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  createdAt: string | number;
};

export type GetUserInfoResponse = {
  response: CommonResponse;
  user?: UserInfo;
};

type UserUnary<TResponse> = (
  request: Record<string, unknown>,
  metadata: grpc.Metadata,
  options: grpc.CallOptions,
  callback: (error: grpc.ServiceError | null, response: TResponse) => void
) => void;

type UserGrpcClient = grpc.Client & {
  Register: UserUnary<RegisterResponse>;
  RefreshToken: UserUnary<RefreshTokenResponse>;
  ValidateToken: UserUnary<ValidateTokenResponse>;
  GetUserInfo: UserUnary<GetUserInfoResponse>;
  GetUserByUsername: UserUnary<GetUserInfoResponse>;
};

type UserServiceConstructor = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: grpc.ChannelOptions
) => UserGrpcClient;

let cachedClient: UserGrpcClient | null = null;

export function invokeRegister(request: Record<string, unknown>) {
  return invokeUser<RegisterResponse>("Register", request);
}

export function invokeRefreshToken(request: Record<string, unknown>) {
  return invokeUser<RefreshTokenResponse>("RefreshToken", request);
}

export function invokeValidateToken(request: Record<string, unknown>) {
  return invokeUser<ValidateTokenResponse>("ValidateToken", request);
}

export function invokeGetUserInfo(request: Record<string, unknown>) {
  return invokeUser<GetUserInfoResponse>("GetUserInfo", request);
}

export function invokeGetUserByUsername(request: Record<string, unknown>) {
  return invokeUser<GetUserInfoResponse>("GetUserByUsername", request);
}

export function statusForUserCode(code: number) {
  if (code === 3003) return 409;
  if (code === 3002) return 404;
  if ([1001, 3004, 3005, 3006].includes(code)) return 400;
  if ([3000, 3001, 3007, 15002].includes(code)) return 401;
  return 502;
}

export function userCodeToString(code: number) {
  const names: Record<number, string> = {
    1001: "INVALID_ARGUMENT",
    3000: "AUTH_FAILED",
    3001: "TOKEN_INVALID",
    3002: "USER_NOT_FOUND",
    3003: "USER_ALREADY_EXISTS",
    3004: "PASSWORD_TOO_SHORT",
    3005: "USERNAME_EMPTY",
    3006: "PASSWORD_EMPTY",
    3007: "TOKEN_EXPIRED",
    15002: "TOKEN_REFRESH_FAILED"
  };
  return names[code] ?? `USER_SERVICE_ERROR_${code}`;
}

function invokeUser<TResponse>(
  method: "Register" | "RefreshToken" | "ValidateToken" | "GetUserInfo" | "GetUserByUsername",
  request: Record<string, unknown>
) {
  return new Promise<TResponse>((resolve, reject) => {
    getUserClient()[method](request, internalMetadata(), { deadline: Date.now() + config.gatewayRequestTimeoutMs }, (error, response) => {
      if (error) reject(error);
      else resolve(response as TResponse);
    });
  });
}

function getUserClient(): UserGrpcClient {
  if (cachedClient) return cachedClient;

  const packageDefinition = protoLoader.loadSync(path.join(config.protoDir, "user.proto"), {
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
  const UserService = proto?.UserService as UserServiceConstructor | undefined;
  if (!UserService) {
    throw new Error("Failed to load nebula.proto.UserService from user.proto.");
  }

  cachedClient = new UserService(
    `${config.userServiceHost}:${config.userServicePort}`,
    grpcChannelCredentials(),
    grpcChannelOptions()
  );
  return cachedClient;
}
