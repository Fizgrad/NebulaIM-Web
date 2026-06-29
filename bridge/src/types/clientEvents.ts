export type ClientEventType =
  | "auth.login"
  | "connection.heartbeat"
  | "message.send_single"
  | "message.send_group"
  | "message.ack"
  | "message.pull_offline";

export type BaseClientEvent<TType extends ClientEventType, TPayload> = {
  id: string;
  type: TType;
  timestamp: number;
  payload: TPayload;
};

export type LoginEvent = BaseClientEvent<
  "auth.login",
  {
    username: string;
    password: string;
  }
>;

export type HeartbeatEvent = BaseClientEvent<"connection.heartbeat", Record<string, never>>;

export type SendSingleMessageEvent = BaseClientEvent<
  "message.send_single",
  {
    fromUserId: string;
    toUserId: string;
    content: string;
    contentType: "text";
    clientSequenceId: number;
  }
>;

export type SendGroupMessageEvent = BaseClientEvent<
  "message.send_group",
  {
    fromUserId: string;
    groupId: string;
    content: string;
    contentType: "text";
    clientSequenceId: number;
  }
>;

export type AckMessageEvent = BaseClientEvent<
  "message.ack",
  {
    userId: string;
    messageId: string;
  }
>;

export type PullOfflineMessagesEvent = BaseClientEvent<
  "message.pull_offline",
  {
    userId: string;
    page: number;
    pageSize: number;
  }
>;

export type ClientEvent =
  | LoginEvent
  | HeartbeatEvent
  | SendSingleMessageEvent
  | SendGroupMessageEvent
  | AckMessageEvent
  | PullOfflineMessagesEvent;
