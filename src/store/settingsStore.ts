import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";
export type LanguageMode = "en" | "zh";

const developmentBridgeHost = "127.0.0.1:8080";

type SettingsState = {
  theme: ThemeMode;
  language: LanguageMode;
  gatewayUrl: string;
  directGatewayWsUrl: string;
  bridgeHttpUrl: string;
  autoReconnect: boolean;
  heartbeatIntervalMs: number;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: LanguageMode) => void;
  setGatewayUrl: (url: string) => void;
  setDirectGatewayWsUrl: (url: string) => void;
  setBridgeHttpUrl: (url: string) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setHeartbeatIntervalMs: (value: number) => void;
  resetSettings: () => void;
};

const defaults = {
  theme: "dark" as ThemeMode,
  language: defaultLanguage(),
  gatewayUrl: defaultGatewayUrl(),
  directGatewayWsUrl: import.meta.env.VITE_GATEWAY_WS_URL ?? defaultDirectGatewayWsUrl(),
  bridgeHttpUrl: import.meta.env.VITE_BRIDGE_HTTP_URL ?? defaultBridgeHttpUrl(),
  autoReconnect: true,
  heartbeatIntervalMs: 15000
};

function defaultLanguage(): LanguageMode {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) return "zh";
  return "en";
}

function isDevServer() {
  return typeof window !== "undefined" && ["5173", "5174"].includes(window.location.port);
}

function defaultGatewayUrl() {
  const host = typeof window === "undefined" || isDevServer() ? "127.0.0.1" : window.location.hostname;
  return `tcp://${host}:9000`;
}

function defaultDirectGatewayWsUrl() {
  if (typeof window === "undefined") return `ws://${developmentBridgeHost}/ws`;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (isDevServer()) return `ws://${developmentBridgeHost}/ws`;
  return `${protocol}//${window.location.host}/ws`;
}

function defaultBridgeHttpUrl() {
  if (typeof window === "undefined") return `http://${developmentBridgeHost}`;
  if (isDevServer()) return `http://${developmentBridgeHost}`;
  return window.location.origin;
}

function normalizeGatewayUrl(value: string | undefined) {
  if (!value || value === "tcp://localhost:9000" || value === "tcp://127.0.0.1:9000" || isExternalPersistedGatewayUrl(value)) {
    return defaults.gatewayUrl;
  }
  return value;
}

function isExternalPersistedGatewayUrl(value: string) {
  if (typeof window === "undefined" || isDevServer()) return false;
  const match = /^tcp:\/\/([^:/]+)(?::\d+)?$/i.exec(value);
  return Boolean(match && match[1] !== window.location.hostname);
}

function normalizeDirectGatewayWsUrl(value: string | undefined) {
  if (!value || value === "ws://localhost:9000/" || value === "ws://127.0.0.1:9000/" || isExternalPersistedUrl(value)) {
    return defaults.directGatewayWsUrl;
  }
  return value;
}

function normalizeBridgeHttpUrl(value: string | undefined) {
  if (!value || value === "http://localhost:8080" || value === "http://127.0.0.1:8080" || isExternalPersistedUrl(value)) {
    return defaults.bridgeHttpUrl;
  }
  return value;
}

function isExternalPersistedUrl(value: string) {
  if (typeof window === "undefined" || isDevServer()) return false;
  try {
    const url = new URL(value);
    return url.host !== window.location.host;
  } catch {
    return false;
  }
}

function normalizeLanguage(value: LanguageMode | undefined) {
  return value === "zh" || value === "en" ? value : defaults.language;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setGatewayUrl: (gatewayUrl) => set({ gatewayUrl }),
      setDirectGatewayWsUrl: (directGatewayWsUrl) => set({ directGatewayWsUrl }),
      setBridgeHttpUrl: (bridgeHttpUrl) => set({ bridgeHttpUrl }),
      setAutoReconnect: (autoReconnect) => set({ autoReconnect }),
      setHeartbeatIntervalMs: (heartbeatIntervalMs) => set({ heartbeatIntervalMs }),
      resetSettings: () => set(defaults)
    }),
    {
      name: "nebulaim-settings",
      version: 10,
      merge: (persistedState, currentState) => {
        const state = persistedState as Partial<SettingsState> | undefined;
        return {
          ...currentState,
          ...state,
          language: normalizeLanguage(state?.language),
          gatewayUrl: normalizeGatewayUrl(state?.gatewayUrl),
          directGatewayWsUrl: normalizeDirectGatewayWsUrl(state?.directGatewayWsUrl),
          bridgeHttpUrl: normalizeBridgeHttpUrl(state?.bridgeHttpUrl)
        };
      },
      migrate: (persistedState) => {
        const state = persistedState as Partial<SettingsState>;
        return {
          theme: state.theme ?? defaults.theme,
          language: normalizeLanguage(state.language),
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
