import { useNavigate } from "react-router-dom";
import { CheckCircle2, LogOut, RotateCcw, Trash2, Wifi } from "lucide-react";
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
import { resetGatewayClient } from "../services/gatewayClient";
import { cn } from "../utils/cn";

const themes: ThemeMode[] = ["dark", "light", "system"];

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
    <PageContainer title="Settings" subtitle="Mock mode and Real Bridge integration controls.">
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card className="space-y-6 p-5">
          <section>
            <h2 className="text-base font-semibold text-nebula-text">Theme</h2>
            <div className="mt-3 inline-flex rounded-lg border border-nebula-border bg-white/[0.04] p-1">
              {themes.map((theme) => (
                <button
                  key={theme}
                  onClick={() => settings.setTheme(theme)}
                  className={cn(
                    "h-9 rounded-md px-4 text-sm capitalize transition",
                    settings.theme === theme ? "bg-cyan-300/14 text-cyan-100" : "text-nebula-muted hover:text-nebula-text"
                  )}
                >
                  {theme}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-nebula-text">Connection Mode</h2>
            <div className="mt-3 inline-flex rounded-lg border border-nebula-border bg-white/[0.04] p-1">
              {[
                ["mock", "Mock"],
                ["real", "Real Bridge"]
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    settings.setConnectionMode(mode as "mock" | "real");
                    resetGatewayClient();
                  }}
                  className={cn(
                    "h-9 rounded-md px-4 text-sm transition",
                    settings.connectionMode === mode ? "bg-cyan-300/14 text-cyan-100" : "text-nebula-muted hover:text-nebula-text"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span>
                <span className="block text-sm font-medium text-nebula-text">Mock API Mode</span>
                <span className="mt-1 block text-xs text-nebula-muted">Use Promise-based mock APIs for all client flows.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.connectionMode === "mock"}
                onChange={(event) => {
                  settings.setConnectionMode(event.target.checked ? "mock" : "real");
                  resetGatewayClient();
                }}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-4">
              <span>
                <span className="block text-sm font-medium text-nebula-text">Random Send Failure</span>
                <span className="mt-1 block text-xs text-nebula-muted">Simulate occasional failed messages.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.randomFailureEnabled}
                onChange={(event) => settings.setRandomFailureEnabled(event.target.checked)}
              />
            </label>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Input label="Gateway TCP Address" value={settings.gatewayUrl} onChange={(event) => settings.setGatewayUrl(event.target.value)} />
            <Input label="WebSocket Gateway URL" value={settings.websocketUrl} onChange={(event) => settings.setWebsocketUrl(event.target.value)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <Input label="Bridge WebSocket URL" value={settings.bridgeWsUrl} onChange={(event) => settings.setBridgeWsUrl(event.target.value)} />
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
                <span className="mt-1 block text-xs text-nebula-muted">Reconnect Real Bridge WebSocket after disconnect.</span>
              </span>
              <input type="checkbox" checked={settings.autoReconnect} onChange={(event) => settings.setAutoReconnect(event.target.checked)} />
            </label>
          </section>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-base font-semibold text-nebula-text">Local Actions</h2>
          <Button variant="primary" className="w-full justify-start" onClick={() => void handleTestConnection()} disabled={testState === "loading"}>
            {testState === "loading" ? <Spinner /> : testState === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            Test Bridge
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
    </PageContainer>
  );
}
