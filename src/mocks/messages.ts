import type { Message } from "../types/message";

const now = Date.now();

export const mockMessages: Message[] = [
  {
    id: "m-1",
    conversationId: "c-alice",
    fromUserId: "u-alice",
    toUserId: "u-current",
    content: "I deployed the new Gateway node and the epoll loop looks stable.",
    contentType: "text",
    status: "read",
    createdAt: now - 1000 * 60 * 18,
    isMine: false
  },
  {
    id: "m-2",
    conversationId: "c-alice",
    fromUserId: "u-current",
    toUserId: "u-alice",
    content: "Good. I will check the ACK timeline from browser to MessageService.",
    contentType: "text",
    status: "read",
    createdAt: now - 1000 * 60 * 15,
    isMine: true
  },
  {
    id: "m-3",
    conversationId: "c-alice",
    fromUserId: "u-alice",
    toUserId: "u-current",
    content: "Gateway heartbeat is stable now.",
    contentType: "text",
    status: "read",
    createdAt: now - 1000 * 60 * 2,
    isMine: false
  },
  {
    id: "m-4",
    conversationId: "c-team",
    fromUserId: "u-diana",
    groupId: "g-core",
    content: "Kafka push pipeline has recovered.",
    contentType: "text",
    status: "delivered",
    createdAt: now - 1000 * 60 * 8,
    isMine: false
  },
  {
    id: "m-5",
    conversationId: "c-bob",
    fromUserId: "u-bob",
    toUserId: "u-current",
    content: "ACK path looks clean in the trace.",
    contentType: "text",
    status: "delivered",
    createdAt: now - 1000 * 60 * 28,
    isMine: false
  },
  {
    id: "m-6",
    conversationId: "c-infra",
    fromUserId: "u-current",
    groupId: "g-infra",
    content: "Redis presence TTL has been refreshed.",
    contentType: "text",
    status: "read",
    createdAt: now - 1000 * 60 * 48,
    isMine: true
  },
  {
    id: "m-7",
    conversationId: "c-charlie",
    fromUserId: "u-charlie",
    toUserId: "u-current",
    content: "Offline messages are ready to pull.",
    contentType: "text",
    status: "delivered",
    createdAt: now - 1000 * 60 * 80,
    isMine: false
  }
];
