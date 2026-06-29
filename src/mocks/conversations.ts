import type { Conversation } from "../types/conversation";

const now = Date.now();

export const mockConversations: Conversation[] = [
  {
    id: "c-alice",
    type: "single",
    title: "Alice",
    online: true,
    lastMessage: "Gateway heartbeat is stable now.",
    lastMessageAt: now - 1000 * 60 * 2,
    unreadCount: 0,
    targetUserId: "u-alice"
  },
  {
    id: "c-team",
    type: "group",
    title: "Nebula Core Team",
    lastMessage: "Kafka push pipeline has recovered.",
    lastMessageAt: now - 1000 * 60 * 8,
    unreadCount: 3,
    groupId: "g-core"
  },
  {
    id: "c-bob",
    type: "single",
    title: "Bob",
    online: true,
    lastMessage: "ACK path looks clean in the trace.",
    lastMessageAt: now - 1000 * 60 * 28,
    unreadCount: 1,
    targetUserId: "u-bob"
  },
  {
    id: "c-infra",
    type: "group",
    title: "Backend Infra Group",
    lastMessage: "Redis presence TTL has been refreshed.",
    lastMessageAt: now - 1000 * 60 * 48,
    unreadCount: 0,
    groupId: "g-infra"
  },
  {
    id: "c-charlie",
    type: "single",
    title: "Charlie",
    online: false,
    lastMessage: "Offline messages are ready to pull.",
    lastMessageAt: now - 1000 * 60 * 80,
    unreadCount: 0,
    targetUserId: "u-charlie"
  }
];
