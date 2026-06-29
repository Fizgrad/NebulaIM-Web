import type { Message, SendMessagePayload } from "../types/message";
import { mockMessages } from "../mocks/messages";
import { createId } from "../utils/id";
import { mockRequest } from "./client";

export async function sendSingleMessage(payload: SendMessagePayload) {
  void payload;
  return mockRequest<{ messageId: string; status: "sent"; createdAt: number }>(
    () => ({
      messageId: createId("msg"),
      status: "sent",
      createdAt: Date.now()
    }),
    { randomFailure: true, failRate: 0.08 }
  );
}

export async function sendGroupMessage(payload: SendMessagePayload) {
  void payload;
  return mockRequest<{ messageId: string; status: "sent"; createdAt: number }>(
    () => ({
      messageId: createId("grpmsg"),
      status: "sent",
      createdAt: Date.now()
    }),
    { randomFailure: true, failRate: 0.08 }
  );
}

export async function ackMessage(messageId: string) {
  return mockRequest<{ messageId: string; ack: true }>(() => ({ messageId, ack: true }), {
    min: 120,
    max: 360
  });
}

export async function pullOfflineMessages() {
  return mockRequest<Message[]>(
    () =>
      mockMessages.filter((message) => !message.isMine && message.status !== "read").map((message) => ({
        ...message,
        id: createId("offline"),
        createdAt: Date.now() - 1000 * 60
      })),
    { min: 300, max: 700 }
  );
}
