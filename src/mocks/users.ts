import type { User } from "../types/user";

const now = Date.now();

export const currentUser: User = {
  id: "u-current",
  username: "demo",
  nickname: "Nebula Operator",
  avatarColor: "from-violet-500 to-cyan-400",
  status: "online",
  registeredAt: now - 1000 * 60 * 60 * 24 * 88,
  gateway: "gateway-shanghai-01:9000",
  connectionId: "conn_7f3a9c2e"
};

export const mockUsers: User[] = [
  currentUser,
  {
    id: "u-alice",
    username: "alice",
    nickname: "Alice",
    avatarColor: "from-cyan-400 to-blue-500",
    status: "online",
    registeredAt: now - 1000 * 60 * 60 * 24 * 240,
    gateway: "gateway-shanghai-01:9000",
    connectionId: "conn_91aa2b10"
  },
  {
    id: "u-bob",
    username: "bob",
    nickname: "Bob",
    avatarColor: "from-emerald-400 to-teal-500",
    status: "away",
    registeredAt: now - 1000 * 60 * 60 * 24 * 140,
    gateway: "gateway-beijing-02:9000",
    connectionId: "conn_28bc9a41"
  },
  {
    id: "u-charlie",
    username: "charlie",
    nickname: "Charlie",
    avatarColor: "from-amber-400 to-orange-500",
    status: "offline",
    registeredAt: now - 1000 * 60 * 60 * 24 * 310,
    gateway: "gateway-offline",
    connectionId: "disconnected"
  },
  {
    id: "u-diana",
    username: "diana",
    nickname: "Diana",
    avatarColor: "from-fuchsia-400 to-violet-500",
    status: "online",
    registeredAt: now - 1000 * 60 * 60 * 24 * 67,
    gateway: "gateway-shenzhen-01:9000",
    connectionId: "conn_af039d72"
  }
];
