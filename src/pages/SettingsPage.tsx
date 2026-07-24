import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Wifi
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  kickAllBridgeDevices,
  kickBridgeDevice,
  listBridgeDevices,
  testBridgeConnection,
  type BridgeDeviceInfo
} from "../api/bridgeApi";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { PageContainer } from "../components/layout/PageContainer";
import { Spinner } from "../components/common/Spinner";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";
import { useSettingsStore, type ThemeMode } from "../store/settingsStore";
import { cn } from "../utils/cn";
import { languageOptions, useI18n, type TranslationKey } from "../i18n";
import { formatRelativeTime } from "../utils/time";
import { currentDeviceId } from "../services/deviceIdentity";

const themes: Array<{ value: ThemeMode; labelKey: TranslationKey }> = [
  { value: "dark", labelKey: "theme.dark" },
  { value: "light", labelKey: "theme.light" },
  { value: "system", labelKey: "theme.system" }
];
const themeIcons = {
  dark: Moon,
  light: Sun,
  system: Monitor
} satisfies Record<ThemeMode, typeof Moon>;

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const clearLocalChat = useChatStore((state) => state.clearLocalChat);
  const settings = useSettingsStore();
  const { t, language } = useI18n();
  const [testState, setTestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [devices, setDevices] = useState<BridgeDeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState("");
  const [deviceAction, setDeviceAction] = useState("");

  const loadDevices = useCallback(async () => {
    if (!user?.id) {
      setDevices([]);
      return;
    }
    setDevicesLoading(true);
    setDevicesError("");
    try {
      const result = await listBridgeDevices(settings.bridgeHttpUrl);
      setDevices(result);
    } catch (error) {
      setDevicesError(error instanceof Error ? error.message : t("settings.devicesFailed"));
    } finally {
      setDevicesLoading(false);
    }
  }, [settings.bridgeHttpUrl, t, user?.id]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function handleLogout(revokeRemote = true) {
    await logout(revokeRemote);
    navigate("/login");
  }

  function clearLocalData() {
    clearLocalChat();
    window.localStorage.removeItem("nebulaim-auth");
  }

  async function handleTestConnection() {
    setTestState("loading");
    setTestMessage("");
    try {
      const result = await testBridgeConnection(settings.bridgeHttpUrl);
      setTestState("success");
      setTestMessage(
        t("settings.bridgeConnected", {
          service: result.info.name,
          url: settings.bridgeHttpUrl
        })
      );
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : t("settings.bridgeFailed"));
    }
  }

  async function handleKickDevice(deviceId: string) {
    if (!user?.id) return;
    setDeviceAction(deviceId);
    setDevicesError("");
    try {
      await kickBridgeDevice(settings.bridgeHttpUrl, deviceId);
      if (deviceId === currentDeviceId()) {
        await handleLogout(false);
        return;
      }
      await loadDevices();
    } catch (error) {
      setDevicesError(error instanceof Error ? error.message : t("settings.deviceActionFailed"));
    } finally {
      setDeviceAction("");
    }
  }

  async function handleKickAllDevices() {
    if (!user?.id) return;
    setDeviceAction("all");
    setDevicesError("");
    try {
      await kickAllBridgeDevices(settings.bridgeHttpUrl);
      await handleLogout(false);
    } catch (error) {
      setDevicesError(error instanceof Error ? error.message : t("settings.deviceActionFailed"));
    } finally {
      setDeviceAction("");
    }
  }

  return (
    <PageContainer title={t("settings.title")} subtitle={t("settings.subtitle")}>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="space-y-6 p-5">
          <section>
            <h2 className="text-base font-semibold text-nebula-text">{t("language.title")}</h2>
            <p className="mt-1 text-sm text-nebula-muted">{t("language.subtitle")}</p>
            <div className="mt-3 inline-flex rounded-lg border border-nebula-border bg-white/[0.04] p-1">
              {languageOptions.map((language) => (
                <button
                  key={language.value}
                  onClick={() => settings.setLanguage(language.value)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm transition",
                    settings.language === language.value ? "bg-cyan-300/[0.14] text-cyan-100" : "text-nebula-muted hover:text-nebula-text"
                  )}
                >
                  <Languages className="h-4 w-4" />
                  {t(language.labelKey)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-nebula-text">{t("theme.title")}</h2>
            <div className="mt-3 inline-flex rounded-lg border border-nebula-border bg-white/[0.04] p-1">
              {themes.map((theme) => {
                const Icon = themeIcons[theme.value];
                return (
                  <button
                    key={theme.value}
                    onClick={() => settings.setTheme(theme.value)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm transition",
                      settings.theme === theme.value ? "bg-cyan-300/[0.14] text-cyan-100" : "text-nebula-muted hover:text-nebula-text"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(theme.labelKey)}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span>
                <span className="block text-sm font-medium text-nebula-text">{t("settings.backendMode")}</span>
                <span className="mt-1 block text-xs text-nebula-muted">{t("settings.backendModeHint")}</span>
              </span>
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-medium text-cyan-100">
                {t("common.real")}
              </span>
            </label>
            <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span className="block text-sm font-medium text-nebula-text">{t("settings.gatewayTransport")}</span>
              <span className="mt-1 block text-xs text-nebula-muted">{t("settings.gatewayTransportHint")}</span>
              <span className="mt-3 inline-flex rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-medium text-emerald-100">
                {t("settings.directGateway")}
              </span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Input label={t("settings.gatewayTcpAddress")} value={settings.gatewayUrl} onChange={(event) => settings.setGatewayUrl(event.target.value)} />
            <Input
              label={t("settings.directGatewayWsUrl")}
              value={settings.directGatewayWsUrl}
              onChange={(event) => settings.setDirectGatewayWsUrl(event.target.value)}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Input label={t("settings.bridgeHttpUrl")} value={settings.bridgeHttpUrl} onChange={(event) => settings.setBridgeHttpUrl(event.target.value)} />
            <Input
              label={t("settings.heartbeatInterval")}
              type="number"
              min={1000}
              step={1000}
              value={settings.heartbeatIntervalMs}
              onChange={(event) => settings.setHeartbeatIntervalMs(Number(event.target.value))}
            />
            <label className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span>
                <span className="block text-sm font-medium text-nebula-text">{t("settings.autoReconnect")}</span>
                <span className="mt-1 block text-xs text-nebula-muted">{t("settings.autoReconnectHint")}</span>
              </span>
              <input type="checkbox" checked={settings.autoReconnect} onChange={(event) => settings.setAutoReconnect(event.target.checked)} />
            </label>
          </section>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-nebula-text">{t("settings.devices")}</h2>
                <p className="mt-1 text-xs text-nebula-muted">{t("settings.devicesHint")}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void loadDevices()} disabled={devicesLoading || !user?.id} aria-label={t("settings.loadDevices")}>
                {devicesLoading ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            {devicesError ? (
              <div className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100">{devicesError}</div>
            ) : null}
            <div className="space-y-2">
              {devices.length === 0 && !devicesLoading ? (
                <div className="rounded-lg border border-nebula-border bg-white/[0.04] px-3 py-3 text-sm text-nebula-muted">{t("settings.noDevices")}</div>
              ) : null}
              {devices.map((device) => {
                const isCurrent = device.deviceId === currentDeviceId();
                const lastActiveAt = Number(device.lastActiveAt || device.lastLoginAt);
                return (
                  <div key={device.deviceId} className="rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-nebula-text">{device.deviceName}</span>
                          {isCurrent ? (
                            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-medium text-cyan-100">
                              {t("settings.currentDevice")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-nebula-muted">
                          {device.platform || t("common.unavailable")} - {device.deviceId}
                        </p>
                        <p className="mt-1 text-xs text-nebula-muted">
                          {Number.isFinite(lastActiveAt) && lastActiveAt > 0
                            ? formatRelativeTime(lastActiveAt, language)
                            : t("common.unavailable")}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                          device.online
                            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                            : "border-nebula-border bg-white/[0.04] text-nebula-muted"
                        )}
                      >
                        {device.online ? t("settings.deviceOnline") : t("settings.deviceOffline")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full justify-start"
                      onClick={() => void handleKickDevice(device.deviceId)}
                      disabled={Boolean(deviceAction)}
                    >
                      {deviceAction === device.deviceId ? <Spinner /> : <Power className="h-4 w-4" />}
                      {t("settings.kickDevice")}
                    </Button>
                  </div>
                );
              })}
            </div>
            <Button
              variant="danger"
              className="w-full justify-start"
              onClick={() => void handleKickAllDevices()}
              disabled={!user?.id || devices.length === 0 || Boolean(deviceAction)}
            >
              {deviceAction === "all" ? <Spinner /> : <Power className="h-4 w-4" />}
              {t("settings.kickAllDevices")}
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-nebula-text">{t("settings.systemTools")}</h2>
            <Button variant="secondary" className="w-full justify-start" onClick={() => navigate("/dashboard")}>
              <BarChart3 className="h-4 w-4" />
              {t("common.dashboard")}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/admin")}>
              <ShieldCheck className="h-4 w-4" />
              {t("common.adminConsole")}
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-nebula-text">{t("settings.localActions")}</h2>
            <Button variant="primary" className="w-full justify-start" onClick={() => void handleTestConnection()} disabled={testState === "loading"}>
              {testState === "loading" ? <Spinner /> : testState === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              {t("settings.testServices")}
            </Button>
            {testMessage ? (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  testState === "success"
                    ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                    : "border-red-300/20 bg-red-400/10 text-red-100"
                )}
              >
                {testMessage}
              </div>
            ) : null}
            <Button variant="secondary" className="w-full justify-start" onClick={settings.resetSettings}>
              <RotateCcw className="h-4 w-4" />
              {t("settings.reset")}
            </Button>
            <Button variant="danger" className="w-full justify-start" onClick={clearLocalData}>
              <Trash2 className="h-4 w-4" />
              {t("settings.clearLocalData")}
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              {t("common.logout")}
            </Button>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
