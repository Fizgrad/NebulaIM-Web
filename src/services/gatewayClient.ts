import { delay } from "../api/client";
import type {
  GatewayClient,
  GatewayStatus,
  MessageHandler,
  StatusHandler
} from "../types/gateway";
import { createId } from "../utils/id";
import { useSettingsStore } from "../store/settingsStore";
import { DirectGatewayClient } from "./directGatewayClient";

export type { GatewayClient, GatewayStatus, MessageHandler, StatusHandler };

let activeClient: GatewayClient | null = null;
let activeSignature = "";

function createGatewayClient(): GatewayClient {
  const settings = useSettingsStore.getState();
  return new DirectGatewayClient({
    wsUrl: settings.directGatewayWsUrl,
    autoReconnect: settings.autoReconnect,
    heartbeatIntervalMs: settings.heartbeatIntervalMs
  });
}

function getSignature() {
  const settings = useSettingsStore.getState();
  return [
    settings.directGatewayWsUrl,
    settings.autoReconnect,
    settings.heartbeatIntervalMs
  ].join("|");
}

export function getGatewayClient(): GatewayClient {
  const signature = getSignature();
  if (!activeClient || activeSignature !== signature) {
    activeClient?.disconnect();
    activeClient = createGatewayClient();
    activeSignature = signature;
  }
  return activeClient;
}

export function resetGatewayClient() {
  activeClient?.disconnect();
  activeClient = null;
  activeSignature = "";
}

export async function waitForGatewaySettled() {
  await delay(0);
}

export function createLocalMessageId() {
  return createId("local");
}
