export type ConversationType = "single" | "group";

export type Conversation = {
  id: string;
  backendConversationId?: string;
  type: ConversationType;
  title: string;
  avatar?: string;
  online?: boolean;
  lastMessage: string;
  lastMessageId?: string;
  lastMessageAt: number;
  unreadCount: number;
  pinned?: boolean;
  muted?: boolean;
  targetUserId?: string;
  groupId?: string;
};
