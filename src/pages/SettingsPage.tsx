import { useNavigate } from "react-router-dom";
import { BarChart3, CheckCircle2, Languages, LogOut, Monitor, Moon, RotateCcw, ShieldCheck, Sun, Trash2, Wifi } from "lucide-react";
import { useState } from "react";
import { testBridgeConnection } from "../api/bridgeApi";
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
  const logout = useAuthStore((state) => state.logout);
  const clearLocalChat = useChatStore((state) => state.clearLocalChat);
  const settings = useSettingsStore();
  const { t } = useI18n();
  const [testState, setTestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  function handleLogout() {
    logout();
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
      setTestMessage(`${result.info.name} -> ${result.info.gateway}`);
    } catch (error) {
      setTestState("error");
      setTestMessage(error instanceof Error ? error.message : t("settings.bridgeFailed"));
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
            <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {t("common.logout")}
            </Button>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
