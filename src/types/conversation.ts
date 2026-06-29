export type ConversationType = "single" | "group";

export type Conversation = {
  id: string;
  type: ConversationType;
  title: string;
  avatar?: string;
  online?: boolean;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
  targetUserId?: string;
  groupId?: string;
};
