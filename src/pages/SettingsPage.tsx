import { useNavigate } from "react-router-dom";
import { BarChart3, CheckCircle2, LogOut, Monitor, Moon, RotateCcw, ShieldCheck, Sun, Trash2, Wifi } from "lucide-react";
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

const themes: ThemeMode[] = ["dark", "light", "system"];
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
      setTestMessage(error instanceof Error ? error.message : "Bridge connection failed.");
    }
  }

  return (
    <PageContainer title="Settings" subtitle="Gateway and service endpoint controls for the NebulaIM C++ backend.">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="space-y-6 p-5">
          <section>
            <h2 className="text-base font-semibold text-nebula-text">Theme</h2>
            <div className="mt-3 inline-flex rounded-lg border border-nebula-border bg-white/[0.04] p-1">
              {themes.map((theme) => {
                const Icon = themeIcons[theme];
                return (
                  <button
                    key={theme}
                    onClick={() => settings.setTheme(theme)}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm capitalize transition",
                      settings.theme === theme ? "bg-cyan-300/[0.14] text-cyan-100" : "text-nebula-muted hover:text-nebula-text"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {theme}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span>
                <span className="block text-sm font-medium text-nebula-text">Backend Mode</span>
                <span className="mt-1 block text-xs text-nebula-muted">C++ Gateway and backend services are active.</span>
              </span>
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-medium text-cyan-100">
                Real
              </span>
            </label>
            <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span className="block text-sm font-medium text-nebula-text">Gateway Transport</span>
              <span className="mt-1 block text-xs text-nebula-muted">WebSocket binary Packet + Protobuf.</span>
              <span className="mt-3 inline-flex rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-medium text-emerald-100">
                Direct Gateway
              </span>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Input label="Gateway TCP Address" value={settings.gatewayUrl} onChange={(event) => settings.setGatewayUrl(event.target.value)} />
            <Input
              label="Direct Gateway WebSocket URL"
              value={settings.directGatewayWsUrl}
              onChange={(event) => settings.setDirectGatewayWsUrl(event.target.value)}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Input label="Bridge HTTP URL" value={settings.bridgeHttpUrl} onChange={(event) => settings.setBridgeHttpUrl(event.target.value)} />
            <Input
              label="Heartbeat Interval"
              type="number"
              min={1000}
              step={1000}
              value={settings.heartbeatIntervalMs}
              onChange={(event) => settings.setHeartbeatIntervalMs(Number(event.target.value))}
            />
            <label className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span>
                <span className="block text-sm font-medium text-nebula-text">Auto Reconnect</span>
                <span className="mt-1 block text-xs text-nebula-muted">Reconnect Gateway WebSocket after disconnect.</span>
              </span>
              <input type="checkbox" checked={settings.autoReconnect} onChange={(event) => settings.setAutoReconnect(event.target.checked)} />
            </label>
          </section>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-nebula-text">System Tools</h2>
            <Button variant="secondary" className="w-full justify-start" onClick={() => navigate("/dashboard")}>
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/admin")}>
              <ShieldCheck className="h-4 w-4" />
              Admin Console
            </Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-nebula-text">Local Actions</h2>
            <Button variant="primary" className="w-full justify-start" onClick={() => void handleTestConnection()} disabled={testState === "loading"}>
              {testState === "loading" ? <Spinner /> : testState === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              Test Services
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
              Reset settings
            </Button>
            <Button variant="danger" className="w-full justify-start" onClick={clearLocalData}>
              <Trash2 className="h-4 w-4" />
              Clear local data
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
