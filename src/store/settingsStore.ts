import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";

const publicHost = "173.231.53.23";

type SettingsState = {
  theme: ThemeMode;
  gatewayUrl: string;
  directGatewayWsUrl: string;
  bridgeHttpUrl: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
  setTheme: (theme: ThemeMode) => void;
  setGatewayUrl: (url: string) => void;
  setDirectGatewayWsUrl: (url: string) => void;
  setBridgeHttpUrl: (url: string) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setHeartbeatIntervalMs: (value: number) => void;
  resetSettings: () => void;
};

const defaults = {
  theme: "dark" as ThemeMode,
  gatewayUrl: `tcp://${publicHost}:9000`,
  directGatewayWsUrl: import.meta.env.VITE_GATEWAY_WS_URL ?? defaultDirectGatewayWsUrl(),
  bridgeHttpUrl: import.meta.env.VITE_BRIDGE_HTTP_URL ?? defaultBridgeHttpUrl(),
  autoReconnect: true,
  heartbeatIntervalMs: 15000
};

function defaultDirectGatewayWsUrl() {
  if (typeof window === "undefined") return `ws://${publicHost}:8080/ws`;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (["5173", "5174"].includes(window.location.port)) return `ws://${publicHost}:8080/ws`;
  return `${protocol}//${window.location.host}/ws`;
}

function defaultBridgeHttpUrl() {
  if (typeof window === "undefined") return `http://${publicHost}:8080`;
  if (["5173", "5174"].includes(window.location.port)) return `http://${publicHost}:8080`;
  return window.location.origin;
}

function normalizeGatewayUrl(value: string | undefined) {
  if (!value || value === "tcp://localhost:9000" || value === "tcp://127.0.0.1:9000") return defaults.gatewayUrl;
  return value;
}

function normalizeDirectGatewayWsUrl(value: string | undefined) {
  if (!value || value === "ws://localhost:9000/" || value === "ws://127.0.0.1:9000/") {
    return defaults.directGatewayWsUrl;
  }
  return value;
}

function normalizeBridgeHttpUrl(value: string | undefined) {
  if (!value || value === "http://localhost:8080" || value === "http://127.0.0.1:8080") return defaults.bridgeHttpUrl;
  return value;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setGatewayUrl: (gatewayUrl) => set({ gatewayUrl }),
      setDirectGatewayWsUrl: (directGatewayWsUrl) => set({ directGatewayWsUrl }),
      setBridgeHttpUrl: (bridgeHttpUrl) => set({ bridgeHttpUrl }),
      setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
      setHeartbeatIntervalMs: (heartbeatIntervalMs) => set({ heartbeatIntervalMs }),
      resetSettings: () => set(defaults)
    }),
    {
      name: "nebulaim-settings",
      version: 8,
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<SettingsState> | undefined;
        return {
          ...currentState,
          ...state,
          gatewayUrl: normalizeGatewayUrl(state?.gatewayUrl),
          directGatewayWsUrl: normalizeDirectGatewayWsUrl(state?.directGatewayWsUrl),
          bridgeHttpUrl: normalizeBridgeHttpUrl(state?.bridgeHttpUrl)
        };
      },
      migrate: (persistedState) => {
        const state = persistedState as Partial<SettingsState>;
        return {
          theme: state.theme ?? defaults.theme,
          gatewayUrl: normalizeGatewayUrl(state.gatewayUrl),
          directGatewayWsUrl: normalizeDirectGatewayWsUrl(state.directGatewayWsUrl),
          bridgeHttpUrl: normalizeBridgeHttpUrl(state.bridgeHttpUrl),
          autoReconnect: state.autoReconnect ?? defaults.autoReconnect,
          heartbeatIntervalMs: state.heartbeatIntervalMs ?? defaults.heartbeatIntervalMs
        };
      }
    }
  )
);
