import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";

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
  gatewayUrl: "tcp://localhost:9000",
  directGatewayWsUrl: import.meta.env.VITE_GATEWAY_WS_URL ?? defaultDirectGatewayWsUrl(),
  bridgeHttpUrl: import.meta.env.VITE_BRIDGE_HTTP_URL ?? defaultBridgeHttpUrl(),
  autoReconnect: true,
  heartbeatIntervalMs: 15000
};

function defaultDirectGatewayWsUrl() {
  return "ws://localhost:9000/";
}

function defaultBridgeHttpUrl() {
  if (typeof window === "undefined") return "http://localhost:8080";
  if (["5173", "5174"].includes(window.location.port)) return "http://localhost:8080";
  return window.location.origin;
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
      version: 7,
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<SettingsState> | undefined;
        return {
          ...currentState,
          ...state,
          directGatewayWsUrl: state?.directGatewayWsUrl ?? defaults.directGatewayWsUrl,
          bridgeHttpUrl: state?.bridgeHttpUrl ?? defaults.bridgeHttpUrl
        };
      },
      migrate: (persistedState) => {
        const state = persistedState as Partial<SettingsState>;
        return {
          theme: state.theme ?? defaults.theme,
          gatewayUrl: state.gatewayUrl ?? defaults.gatewayUrl,
          directGatewayWsUrl: state.directGatewayWsUrl ?? defaults.directGatewayWsUrl,
          bridgeHttpUrl: state.bridgeHttpUrl ?? defaults.bridgeHttpUrl,
          autoReconnect: state.autoReconnect ?? defaults.autoReconnect,
          heartbeatIntervalMs: state.heartbeatIntervalMs ?? defaults.heartbeatIntervalMs
        };
      }
    }
  )
);
