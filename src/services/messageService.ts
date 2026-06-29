import type { Conversation } from "../types/conversation";
import type { Message, SendMessagePayload } from "../types/message";
import { ackMessage, sendGroupMessage, sendSingleMessage } from "../api/chatApi";
import { delay, mockRequest } from "../api/client";

export async function sendTextMessage(conversation: Conversation, message: Message) {
  const payload: SendMessagePayload = {
    conversationId: conversation.id,
    toUserId: conversation.targetUserId,
    groupId: conversation.groupId,
    content: message.content,
    contentType: "text"
  };

  if (conversation.type === "group") {
    return sendGroupMessage(payload);
  }
  return sendSingleMessage(payload);
}

export async function simulateDelivery(messageId: string) {
  await mockRequest(() => ({ messageId, status: "delivered" as const }), { min: 300, max: 900 });
  await ackMessage(messageId);
  await delay(260);
  return { messageId, status: "read" as const };
}
