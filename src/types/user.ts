export type UserStatus = "online" | "offline" | "away";

export type User = {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  avatarColor: string;
  status: UserStatus;
  registeredAt: number;
  gateway: string;
  connectionId: string;
};
