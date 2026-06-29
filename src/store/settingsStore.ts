import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ConnectionMode, GatewayTransport } from "../types/gateway";

export type ThemeMode = "dark" | "light" | "system";

type SettingsState = {
  theme: ThemeMode;
  mockMode: boolean;
  connectionMode: ConnectionMode;
  gatewayTransport: GatewayTransport;
  gatewayUrl: string;
  websocketUrl: string;
  directGatewayWsUrl: string;
  bridgeWsUrl: string;
  bridgeHttpUrl: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
  randomFailureEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  setMockMode: (enabled: boolean) => void;
  setConnectionMode: (mode: ConnectionMode) => void;
  setGatewayTransport: (transport: GatewayTransport) => void;
  setGatewayUrl: (url: string) => void;
  setWebsocketUrl: (url: string) => void;
  setDirectGatewayWsUrl: (url: string) => void;
  setBridgeWsUrl: (url: string) => void;
  setBridgeHttpUrl: (url: string) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setHeartbeatIntervalMs: (value: number) => void;
  setRandomFailureEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
};

const connectionModeDefault = defaultConnectionMode();

const defaults = {
  theme: "dark" as ThemeMode,
  mockMode: connectionModeDefault === "mock",
  connectionMode: connectionModeDefault,
  gatewayTransport: defaultGatewayTransport(),
  gatewayUrl: "tcp://localhost:9000",
  websocketUrl: import.meta.env.VITE_GATEWAY_WS_URL ?? defaultDirectGatewayWsUrl(),
  directGatewayWsUrl: import.meta.env.VITE_GATEWAY_WS_URL ?? defaultDirectGatewayWsUrl(),
  bridgeWsUrl: import.meta.env.VITE_BRIDGE_WS_URL ?? defaultBridgeWsUrl(),
  bridgeHttpUrl: import.meta.env.VITE_BRIDGE_HTTP_URL ?? defaultBridgeHttpUrl(),
  autoReconnect: true,
  heartbeatIntervalMs: 15000,
  randomFailureEnabled: connectionModeDefault === "mock"
};

function defaultConnectionMode(): ConnectionMode {
  const configured = import.meta.env.VITE_CONNECTION_MODE;
  if (configured === "mock" || configured === "real") return configured;
  return "real";
}

function defaultGatewayTransport(): GatewayTransport {
  const configured = import.meta.env.VITE_GATEWAY_TRANSPORT;
  if (configured === "bridge" || configured === "direct") return configured;
  return "direct";
}

function defaultDirectGatewayWsUrl() {
  return "ws://localhost:9000/";
}

function defaultBridgeHttpUrl() {
  if (typeof window === "undefined") return "http://localhost:8080";
  if (["5173", "5174"].includes(window.location.port)) return "http://localhost:8080";
  return window.location.origin;
}

function defaultBridgeWsUrl() {
  if (typeof window === "undefined") return "ws://localhost:8080/ws";
  if (["5173", "5174"].includes(window.location.port)) return "ws://localhost:8080/ws";
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
      setGatewayTransport: (gatewayTransport) => set({ gatewayTransport }),
      setGatewayUrl: (gatewayUrl) => set({ gatewayUrl }),
      setWebsocketUrl: (websocketUrl) => set({ websocketUrl }),
      setDirectGatewayWsUrl: (directGatewayWsUrl) => set({ directGatewayWsUrl, websocketUrl: directGatewayWsUrl }),
      setBridgeWsUrl: (bridgeWsUrl) => set({ bridgeWsUrl, websocketUrl: bridgeWsUrl }),
      setBridgeHttpUrl: (bridgeHttpUrl) => set({ bridgeHttpUrl }),
      setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
      setHeartbeatIntervalMs: (heartbeatIntervalMs) => set({ heartbeatIntervalMs }),
      setRandomFailureEnabled: (randomFailureEnabled) => set({ randomFailureEnabled }),
      resetSettings: () => set(defaults)
    }),
    {
      name: "nebulaim-settings",
      version: 6,
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<SettingsState> | undefined;
        return {
          ...currentState,
          ...state,
          connectionMode: defaults.connectionMode,
          mockMode: defaults.mockMode,
          gatewayTransport: defaults.gatewayTransport,
          randomFailureEnabled: state?.randomFailureEnabled ?? defaults.randomFailureEnabled
        };
      },
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<SettingsState>;
        if (version < 6) {
          return {
            ...state,
            connectionMode: defaults.connectionMode,
            mockMode: defaults.mockMode,
            gatewayTransport: defaults.gatewayTransport,
            directGatewayWsUrl: state.directGatewayWsUrl ?? defaults.directGatewayWsUrl,
            bridgeWsUrl: state.bridgeWsUrl ?? defaults.bridgeWsUrl,
            bridgeHttpUrl: state.bridgeHttpUrl ?? defaults.bridgeHttpUrl,
            websocketUrl: state.websocketUrl ?? defaults.websocketUrl
          };
        }
        return state;
      }
    }
  )
);
