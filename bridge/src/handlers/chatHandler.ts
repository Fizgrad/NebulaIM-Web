import { MessageType } from "../gateway/MessageType.js";
import { BridgeError } from "../errors/BridgeError.js";
import type {
  AckMessageResponsePayload,
  BridgeSession,
  PullOfflineMessagesResponsePayload,
  SendMessageResponsePayload,
  ServerEvent
} from "../types/bridge.js";
import type {
  AckMessageEvent,
  PullOfflineMessagesEvent,
  SendGroupMessageEvent,
  SendSingleMessageEvent
} from "../types/clientEvents.js";

type ProtoSendMessageResponse = {
  response: ProtoCommonResponse;
  messageId: string;
  serverTimestamp: string;
};

type ProtoAckMessageResponse = {
  response: ProtoCommonResponse;
};

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
  serverTimestamp: string;
};

type ProtoPullOfflineMessagesResponse = {
  response: ProtoCommonResponse;
  messages: ProtoMessageData[];
};

type ProtoCommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

const MESSAGE_CONTENT_TYPE_TEXT = 1;

export async function handleSendSingleMessage(session: BridgeSession, event: SendSingleMessageEvent): Promise<ServerEvent> {
  const body = session.proto.encode("nebula.proto.SendSingleMessageRequest", {
    requestId: event.id,
    fromUserId: toUint64(event.payload.fromUserId, "fromUserId"),
    toUserId: toUint64(event.payload.toUserId, "toUserId"),
    content: event.payload.content,
    contentType: MESSAGE_CONTENT_TYPE_TEXT,
    clientSequenceId: event.payload.clientSequenceId
  });
  const packet = await session.gateway.request(MessageType.SEND_SINGLE_MSG_REQ, body);
  const response = session.proto.decode<ProtoSendMessageResponse>("nebula.proto.SendSingleMessageResponse", packet.body);
  const common = response.response;
  const payload: SendMessageResponsePayload = {
    ok: common.code === 0,
    code: common.code,
    message: common.message,
    messageId: response.messageId,
    serverTimestamp: response.serverTimestamp
  };
  return { id: event.id, type: "message.send_single_result", ok: common.code === 0, timestamp: Date.now(), payload };
}

export async function handleSendGroupMessage(session: BridgeSession, event: SendGroupMessageEvent): Promise<ServerEvent> {
  const body = session.proto.encode("nebula.proto.SendGroupMessageRequest", {
    requestId: event.id,
    fromUserId: toUint64(event.payload.fromUserId, "fromUserId"),
    groupId: toUint64(event.payload.groupId, "groupId"),
    content: event.payload.content,
    contentType: MESSAGE_CONTENT_TYPE_TEXT,
    clientSequenceId: event.payload.clientSequenceId
  });
  const packet = await session.gateway.request(MessageType.SEND_GROUP_MSG_REQ, body);
  const response = session.proto.decode<ProtoSendMessageResponse>("nebula.proto.SendGroupMessageResponse", packet.body);
  const common = response.response;
  const payload: SendMessageResponsePayload = {
    ok: common.code === 0,
    code: common.code,
    message: common.message,
    messageId: response.messageId,
    serverTimestamp: response.serverTimestamp
  };
  return { id: event.id, type: "message.send_group_result", ok: common.code === 0, timestamp: Date.now(), payload };
}

export async function handleAckMessage(session: BridgeSession, event: AckMessageEvent): Promise<ServerEvent> {
  const body = session.proto.encode("nebula.proto.AckMessageRequest", {
    requestId: event.id,
    userId: toUint64(event.payload.userId, "userId"),
    messageId: toUint64(event.payload.messageId, "messageId")
  });
  const packet = await session.gateway.request(MessageType.ACK_REQ, body);
  const response = session.proto.decode<ProtoAckMessageResponse>("nebula.proto.AckMessageResponse", packet.body);
  const common = response.response;
  const payload: AckMessageResponsePayload = {
    ok: common.code === 0,
    code: common.code,
    message: common.message,
    messageId: event.payload.messageId
  };
  return { id: event.id, type: "message.ack_result", ok: common.code === 0, timestamp: Date.now(), payload };
}

export async function handlePullOfflineMessages(session: BridgeSession, event: PullOfflineMessagesEvent): Promise<ServerEvent> {
  const body = session.proto.encode("nebula.proto.PullOfflineMessagesRequest", {
    requestId: event.id,
    userId: toUint64(event.payload.userId, "userId"),
    page: {
      page: event.payload.page,
      pageSize: event.payload.pageSize
    }
  });
  const packet = await session.gateway.request(MessageType.PULL_OFFLINE_MSG_REQ, body);
  const response = session.proto.decode<ProtoPullOfflineMessagesResponse>("nebula.proto.PullOfflineMessagesResponse", packet.body);
  const common = response.response;
  const payload: PullOfflineMessagesResponsePayload = {
    ok: common.code === 0,
    code: common.code,
    message: common.message,
    messages: response.messages.map((message) => ({
      messageId: message.messageId,
      conversationId: message.conversationId,
      fromUserId: message.fromUserId,
      toUserId: message.toUserId || undefined,
      groupId: message.groupId || undefined,
      content: message.content,
      contentType: "text",
      serverTimestamp: message.timestamp
    }))
  };
  return { id: event.id, type: "message.pull_offline_result", ok: common.code === 0, timestamp: Date.now(), payload };
}

function toUint64(value: string, fieldName: string): number {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new BridgeError({
      code: "INVALID_EVENT",
      message: `${fieldName} must be a safe uint64 integer string.`
    });
  }
  return numeric;
}
