import { BridgeError } from "../errors/BridgeError.js";
import { MessageType } from "../gateway/MessageType.js";
import type { BridgeSession, LoginResponsePayload, ServerEvent } from "../types/bridge.js";
import type { LoginEvent } from "../types/clientEvents.js";
import { logger } from "../utils/logger.js";
import { maskToken } from "../utils/id.js";

type ProtoLoginResponse = {
  response: {
    code: number;
    message: string;
    requestId: string;
  };
  userId: string;
  token: string;
  expireAt: string;
};

const GATEWAY_ONLINE_STATE_FAILED = 10006;

export async function handleLogin(session: BridgeSession, event: LoginEvent): Promise<ServerEvent> {
  const body = session.proto.encode("nebula.proto.LoginRequest", {
    requestId: event.id,
    username: event.payload.username,
    password: event.payload.password,
    deviceId: session.id,
    platform: "web",
    deviceName: "NebulaIM Web"
  });
  const packet = await session.gateway.request(MessageType.LOGIN_REQ, body);
  const response = session.proto.decode<ProtoLoginResponse>("nebula.proto.LoginResponse", packet.body);
  const common = response.response;

  if (common.code !== 0 && common.code !== GATEWAY_ONLINE_STATE_FAILED) {
    throw new BridgeError({
      code: "AUTH_FAILED",
      message: common.message || "Login failed."
    });
  }

  session.userId = response.userId;
  session.token = response.token;
  logger.info(`Login result user=${response.userId} token=${maskToken(response.token)} code=${common.code}`, {
    sessionId: session.id
  });

  const payload: LoginResponsePayload = {
    ok: common.code === 0,
    code: common.code,
    message: common.message,
    userId: response.userId,
    token: response.token,
    expireAt: response.expireAt,
    nickname: event.payload.username
  };

  return {
    id: event.id,
    type: "auth.login_result",
    ok: true,
    timestamp: Date.now(),
    payload
  };
}
