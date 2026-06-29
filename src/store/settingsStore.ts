import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectionMode } from "../types/gateway";

export type ThemeMode = "dark" | "light" | "system";

type SettingsState = {
  theme: ThemeMode;
  mockMode: boolean;
  connectionMode: ConnectionMode;
  gatewayUrl: string;
  websocketUrl: string;
  bridgeWsUrl: string;
  bridgeHttpUrl: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
  randomFailureEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  setMockMode: (enabled: boolean) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setGatewayUrl: (url: string) => void;
  setWebsocketUrl: (url: string) => void;
  setBridgeWsUrl: (url: string) => void;
  setBridgeHttpUrl: (url: string) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setHeartbeatIntervalMs: (value: number) => void;
  setRandomFailureEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
};

const defaults = {
  theme: "dark" as ThemeMode,
  mockMode: true,
  connectionMode: "mock" as ConnectionMode,
  gatewayUrl: "tcp://localhost:9000",
  websocketUrl: import.meta.env.VITE_BRIDGE_WS_URL ?? defaultBridgeWsUrl(),
  bridgeWsUrl: import.meta.env.VITE_BRIDGE_WS_URL ?? defaultBridgeWsUrl(),
  bridgeHttpUrl: import.meta.env.VITE_BRIDGE_HTTP_URL ?? defaultBridgeHttpUrl(),
  autoReconnect: true,
  heartbeatIntervalMs: 15000,
  randomFailureEnabled: true
};

function defaultBridgeHttpUrl() {
  if (typeof window === "undefined") return "http://localhost:8080";
  return window.location.origin;
}

function defaultBridgeWsUrl() {
  if (typeof window === "undefined") return "ws://localhost:8080/ws";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setMockMode: (mockMode) => set({ mockMode }),
      setConnectionMode: (connectionMode) => set({ connectionMode, mockMode: connectionMode === "mock" }),
      setGatewayUrl: (gatewayUrl) => set({ gatewayUrl }),
      setWebsocketUrl: (websocketUrl) => set({ websocketUrl }),
      setBridgeWsUrl: (bridgeWsUrl) => set({ bridgeWsUrl, websocketUrl: bridgeWsUrl }),
      setBridgeHttpUrl: (bridgeHttpUrl) => set({ bridgeHttpUrl }),
      setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
      setHeartbeatIntervalMs: (heartbeatIntervalMs) => set({ heartbeatIntervalMs }),
      setRandomFailureEnabled: (randomFailureEnabled) => set({ randomFailureEnabled }),
      resetSettings: () => set(defaults)
    }),
    {
      name: "nebulaim-settings"
    }
  )
);
