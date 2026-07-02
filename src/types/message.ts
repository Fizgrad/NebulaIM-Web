export type MessageContentType = "text";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type Message = {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId?: string;
  groupId?: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  contentType: MessageContentType;
  status: MessageStatus;
  createdAt: number;
  isMine: boolean;
};

export type SendMessagePayload = {
  conversationId: string;
  toUserId?: string;
  groupId?: string;
  content: string;
  contentType: MessageContentType;
};
