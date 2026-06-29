import type { WebSocket } from "ws";
import { MessageType, messageTypeToString } from "../gateway/MessageType.js";
import type { Packet } from "../gateway/Packet.js";
import type { BridgeSession, CommonResponsePayload, ServerEvent } from "../types/bridge.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

type ProtoMessageData = {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toUserId?: string;
  groupId?: string;
  content: string;
  contentType: string;
  status: string;
  timestamp: string;
};

type ProtoCommonResponse = {
  ok: boolean;
  code: number;
  message: string;
  requestId?: string;
};

export function handleGatewayPacket(session: BridgeSession, packet: Packet): void {
  if (packet.type === MessageType.PUSH_MSG) {
    const message = session.proto.decode<ProtoMessageData>("nebula.proto.MessageData", packet.body);
    logger.info("PUSH_MSG received", { sessionId: session.id });
    sendJson(session.ws, {
      id: createId("push"),
      type: "message.push",
      ok: true,
      timestamp: Date.now(),
      payload: {
        messageId: message.messageId,
        conversationId: message.conversationId,
        fromUserId: message.fromUserId,
        toUserId: message.toUserId || undefined,
        groupId: message.groupId || undefined,
        content: message.content,
        contentType: "text",
        serverTimestamp: Number(message.timestamp || Date.now())
      }
    });
    return;
  }

  if (packet.type === MessageType.ERROR_RESP) {
    const response = session.proto.decode<ProtoCommonResponse>("nebula.proto.CommonResponse", packet.body);
    const payload: CommonResponsePayload = {
      ok: response.ok,
      code: response.code,
      message: response.message,
      requestId: response.requestId
    };
    sendJson(session.ws, {
      id: createId("gateway_error"),
      type: "error",
      ok: false,
      timestamp: Date.now(),
      payload,
      error: {
        code: response.code || 500,
        message: response.message || "Gateway error."
      }
    });
    return;
  }

  logger.warn(`Unhandled gateway packet ${messageTypeToString(packet.type)}`, { sessionId: session.id });
}

function sendJson(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}
