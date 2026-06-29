import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types/user";
import * as authApi from "../api/authApi";
import { refreshBridgeToken } from "../api/bridgeApi";
import { getGatewayClient, resetGatewayClient } from "../services/gatewayClient";
import { useSettingsStore } from "./settingsStore";
import { normalizeExpireAt, isTokenExpiringSoon } from "../services/authToken";
import { clientLogger } from "../services/clientLogger";

type AuthState = {
  user: User | null;
  token: string | null;
  tokenExpireAt: number | null;
  lastRefreshAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname: string) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  ensureFreshToken: () => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tokenExpireAt: null,
      lastRefreshAt: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const settings = useSettingsStore.getState();
          if (settings.connectionMode === "real") {
            const gateway = getGatewayClient();
            await gateway.connect();
            const result = await gateway.login(username, password);
            const user: User = {
              id: result.userId,
              username: result.username ?? username,
              nickname: result.nickname ?? username,
              avatarColor: "from-violet-500 to-cyan-400",
              status: "online",
              registeredAt: Date.now(),
              gateway: settings.gatewayUrl,
              connectionId: `bridge-${result.userId}`
            };
            set({
              user,
              token: result.token,
              tokenExpireAt: normalizeExpireAt(result.expireAt),
              lastRefreshAt: Date.now(),
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            return;
          }

          const response = await authApi.login(username, password);
          set({
            user: response.user,
            token: response.token,
            tokenExpireAt: response.expireAt,
            lastRefreshAt: Date.now(),
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Login failed."
          });
          throw error;
        }
      },
      register: async (username, password, nickname) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.register(username, password, nickname);
          set({ isLoading: false, error: null });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : "Registration failed."
          });
          throw error;
        }
      },
      refreshToken: async () => {
        const { token } = get();
        if (!token) return false;
        const settings = useSettingsStore.getState();
        try {
          const response =
            settings.connectionMode === "real"
              ? await refreshBridgeToken(settings.bridgeHttpUrl, token)
              : await authApi.refreshToken(token);
          set({
            token: response.token,
            tokenExpireAt: normalizeExpireAt(response.expireAt),
            lastRefreshAt: Date.now(),
            error: null
          });
          clientLogger.info("Auth token refreshed");
          return true;
        } catch (error) {
          clientLogger.warn("Auth token refresh failed", error);
          set({ error: error instanceof Error ? error.message : "Token refresh failed." });
          return false;
        }
      },
      ensureFreshToken: async () => {
        const state = get();
        if (!state.isAuthenticated || !state.token) return false;
        if (!isTokenExpiringSoon(state.tokenExpireAt)) return true;
        return state.refreshToken();
      },
      logout: () => {
        resetGatewayClient();
        set({ user: null, token: null, tokenExpireAt: null, lastRefreshAt: null, isAuthenticated: false, error: null });
      },
      clearError: () => set({ error: null })
    }),
    {
      name: "nebulaim-auth",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        tokenExpireAt: state.tokenExpireAt,
        lastRefreshAt: state.lastRefreshAt,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
