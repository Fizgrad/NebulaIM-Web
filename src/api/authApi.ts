import type { User } from "../types/user";
import { createId } from "../utils/id";
import { currentUser, mockUsers } from "../mocks/users";
import { ApiError, mockRequest } from "./client";

const registeredUsers: User[] = [...mockUsers];

export type AuthResponse = {
  user: User;
  token: string;
  expireAt: number;
};

export async function login(username: string, password: string) {
  return mockRequest<AuthResponse>(() => {
    if (!username.trim() || !password.trim()) {
      throw new ApiError({ code: "INVALID_CREDENTIALS", message: "Username and password are required." }, 401);
    }

    const existing = registeredUsers.find((user) => user.username === username.trim());
    const user = existing ?? {
      ...currentUser,
      id: createId("u"),
      username: username.trim(),
      nickname: username.trim(),
      connectionId: createId("conn")
    };

    return {
      user,
      token: `nebula_mock_token_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      expireAt: Date.now() + 60 * 60 * 1000
    };
  });
}

export async function register(username: string, password: string, nickname: string) {
  return mockRequest<{ user: User }>(() => {
    if (!username.trim() || !password.trim() || !nickname.trim()) {
      throw new ApiError({ code: "VALIDATION_ERROR", message: "All fields are required." }, 422);
    }
    if (password.length < 6) {
      throw new ApiError({ code: "WEAK_PASSWORD", message: "Password must be at least 6 characters." }, 422);
    }
    if (registeredUsers.some((user) => user.username === username.trim())) {
      throw new ApiError({ code: "USERNAME_EXISTS", message: "Username already exists in mock data." }, 409);
    }

    const user: User = {
      ...currentUser,
      id: createId("u"),
      username: username.trim(),
      nickname: nickname.trim(),
      registeredAt: Date.now(),
      connectionId: createId("conn")
    };
    registeredUsers.push(user);
    return { user };
  });
}

export async function validateToken(token: string) {
  return mockRequest<{ valid: boolean }>(() => ({ valid: token.startsWith("nebula_mock_token_") }));
}

export async function getUserInfo() {
  return mockRequest<User>(() => currentUser);
}

export async function refreshToken(token: string) {
  return mockRequest<{ token: string; expireAt: number }>(() => {
    if (!token.startsWith("nebula_mock_token_")) {
      throw new ApiError({ code: "INVALID_TOKEN", message: "Mock token is invalid." }, 401);
    }
    return {
      token: `nebula_mock_token_refresh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      expireAt: Date.now() + 60 * 60 * 1000
    };
  });
}
