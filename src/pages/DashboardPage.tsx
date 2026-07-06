import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Database, KeyRound, Link2, Radio, RefreshCw, Server, Shield, TrendingUp } from "lucide-react";
import type { BridgeHealth, BridgeInfo } from "../types/bridge";
import type { DashboardRuntime } from "../api/dashboardApi";
import { getDashboardRuntime } from "../api/dashboardApi";
import { getBridgeHealth, getBridgeInfo } from "../api/bridgeApi";
import { Logo } from "../components/brand/Logo";
import { NebulaBackground } from "../components/brand/NebulaBackground";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Input } from "../components/common/Input";
import { PageContainer } from "../components/layout/PageContainer";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ServiceHealthCard } from "../components/dashboard/ServiceHealthCard";
import { EventTimeline } from "../components/dashboard/EventTimeline";
import { formatNumber, formatPercent } from "../utils/format";
import { useSettingsStore } from "../store/settingsStore";
import { useChatStore } from "../store/chatStore";
import { useAdminStore } from "../store/adminStore";
import { formatShortTime } from "../utils/time";
import { useI18n } from "../i18n";

type DashboardPageProps = {
  embedded?: boolean;
};

export function DashboardPage({ embedded = false }: DashboardPageProps) {
  const [runtime, setRuntime] = useState<DashboardRuntime | null>(null);
  const [runtimeError, setRuntimeError] = useState("");
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(false);
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null);
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  const [bridgeError, setBridgeError] = useState("");
  const settings = useSettingsStore();
  const { t, locale } = useI18n();
  const gatewayStatus = useChatStore((state) => state.gatewayStatus);
  const adminToken = useAdminStore((state) => state.adminToken);
  const setAdminToken = useAdminStore((state) => state.setAdminToken);
  const [tokenInput, setTokenInput] = useState(adminToken);

  const totalOutbox = runtime?.totalOutbox ?? 0;

  const loadRuntime = useCallback(
    async (token = adminToken) => {
      const trimmedToken = token.trim();
      if (!trimmedToken) {
        setRuntime(null);
        setRuntimeError(t("dashboard.tokenRequired"));
        return;
      }
      setIsRuntimeLoading(true);
      setRuntimeError("");
      try {
        const response = await getDashboardRuntime(settings.bridgeHttpUrl, trimmedToken);
        setRuntime(response);
      } catch (error) {
        setRuntime(null);
        setRuntimeError(error instanceof Error ? error.message : t("dashboard.loadFailed"));
      } finally {
        setIsRuntimeLoading(false);
      }
    },
    [adminToken, settings.bridgeHttpUrl, t]
  );

  useEffect(() => {
    let mounted = true;
    setBridgeError("");
    Promise.all([getBridgeHealth(settings.bridgeHttpUrl), getBridgeInfo(settings.bridgeHttpUrl)])
      .then(([healthResponse, infoResponse]) => {
        if (!mounted) return;
        setBridgeHealth(healthResponse);
        setBridgeInfo(infoResponse);
      })
      .catch((error) => {
        if (!mounted) return;
        setBridgeHealth(null);
        setBridgeInfo(null);
        setBridgeError(error instanceof Error ? error.message : t("dashboard.bridgeUnavailable"));
      });
    return () => {
      mounted = false;
    };
  }, [settings.bridgeHttpUrl, t]);

  useEffect(() => {
    setTokenInput(adminToken);
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken.trim()) {
      setRuntime(null);
      setRuntimeError("");
      return;
    }
    void loadRuntime(adminToken);
  }, [adminToken, loadRuntime]);

  function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    setAdminToken(nextToken);
    void loadRuntime(nextToken);
  }

  const kafkaLagHint = useMemo(() => {
    if (!runtime) return t("dashboard.kafkaLagHint");
    return runtime.overview.kafkaLag.lags.length > 0
      ? t("dashboard.consumerGroups", { count: runtime.overview.kafkaLag.lags.length })
      : runtime.overview.kafkaLag.response.message || t("dashboard.noLagEntries");
  }, [runtime, t]);

  const dashboardContent = (
    <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-nebula-muted">{t("dashboard.bridgeStatus")}</p>
                  <p className="mt-3 text-2xl font-semibold text-nebula-text">{bridgeHealth?.ok ? t("common.online") : t("common.offline")}</p>
                  <p className="mt-1 text-xs text-slate-400">{bridgeInfo?.gateway ?? bridgeError ?? settings.bridgeHttpUrl}</p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  <Link2 className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={gatewayStatus.state === "connected" ? "emerald" : "amber"}>
                  {t("dashboard.tcp", { state: gatewayStatus.state })}
                </Badge>
                <Badge tone="violet">
                  {t("dashboard.heartbeat", { state: gatewayStatus.lastHeartbeatAt ? formatShortTime(gatewayStatus.lastHeartbeatAt, locale) : t("dashboard.waiting") })}
                </Badge>
              </div>
            </Card>

            {runtime ? (
              <>
                <MetricCard
                  label={t("dashboard.gatewayConnections")}
                  value={formatNumber(Number(runtime.overview.systemStats.activeConnections))}
                  hint={t("dashboard.systemStatsHint")}
                  icon={Server}
                />
                <MetricCard
                  label={t("dashboard.onlineUsers")}
                  value={formatNumber(Number(runtime.overview.systemStats.onlineUsers))}
                  hint={t("dashboard.systemStatsHint")}
                  icon={Radio}
                />
                <MetricCard
                  label={t("dashboard.outboxEvents")}
                  value={formatNumber(totalOutbox)}
                  hint={t("dashboard.outboxHint")}
                  icon={Database}
                />
                <MetricCard
                  label={t("dashboard.outboxPublishRate")}
                  value={formatPercent(runtime.outboxPublishRate)}
                  hint={t("dashboard.publishRateHint")}
                  icon={TrendingUp}
                />
                <MetricCard
                  label={t("dashboard.kafkaLag")}
                  value={formatNumber(runtime.totalKafkaLag)}
                  hint={kafkaLagHint}
                  icon={Activity}
                />
              </>
            ) : (
              <Card className="p-4 md:col-span-2">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-100">
                    <Shield className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-nebula-text">{t("dashboard.adminTokenRequired")}</h2>
                    <p className="mt-1 text-sm text-nebula-muted">{t("dashboard.adminTokenHint")}</p>
                    <form className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]" onSubmit={handleTokenSubmit}>
                      <Input
                        label={t("dashboard.adminToken")}
                        type="password"
                        value={tokenInput}
                        onChange={(event) => setTokenInput(event.target.value)}
                        placeholder={t("dashboard.adminTokenPlaceholder")}
                        autoComplete="off"
                        icon={<KeyRound className="h-4 w-4" />}
                      />
                      <div className="flex items-end">
                        <Button type="submit" variant="primary" disabled={isRuntimeLoading}>
                          {isRuntimeLoading ? <Spinner /> : <Shield className="h-4 w-4" />}
                          {t("dashboard.loadMetrics")}
                        </Button>
                      </div>
                    </form>
                    {runtimeError ? (
                      <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {runtimeError}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {runtime ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-nebula-text">{t("dashboard.snapshot")}</p>
                  <p className="mt-1 text-xs text-nebula-muted">{t("dashboard.lastChecked", { time: formatShortTime(runtime.checkedAt, locale) })}</p>
                </div>
                <Button variant="secondary" onClick={() => void loadRuntime()} disabled={isRuntimeLoading}>
                  {isRuntimeLoading ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
                  {t("common.refresh")}
                </Button>
              </div>

              {runtimeError ? (
                <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {runtimeError}
                </div>
              ) : null}

              <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
                <Card className="p-4">
                  <div className="mb-5">
                    <h2 className="text-base font-semibold text-nebula-text">{t("dashboard.outboxStatus")}</h2>
                    <p className="mt-1 text-sm text-nebula-muted">{t("dashboard.outboxStatusHint")}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      [t("dashboard.pending"), runtime.overview.outboxStats.pending, "amber"],
                      [t("dashboard.published"), runtime.overview.outboxStats.published, "emerald"],
                      [t("dashboard.failed"), runtime.overview.outboxStats.failed, "red"],
                      [t("dashboard.dead"), runtime.overview.outboxStats.dead, "slate"]
                    ].map(([label, value, tone]) => (
                      <div key={label} className="rounded-lg border border-nebula-border bg-white/[0.04] p-4">
                        <Badge tone={tone as "amber" | "emerald" | "red" | "slate"}>{label}</Badge>
                        <p className="mt-3 text-2xl font-semibold text-nebula-text">{formatNumber(Number(value))}</p>
                      </div>
                    ))}
                  </div>
                </Card>
                <EventTimeline events={runtime.events} />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {runtime.serviceHealth.map((service) => (
                  <ServiceHealthCard key={service.name} service={service} />
                ))}
              </div>
            </>
          ) : null}
        </div>
  );

  if (embedded) {
    return (
      <PageContainer title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
        {dashboardContent}
      </PageContainer>
    );
  }

  return (
    <div className="min-h-screen bg-nebula-bg text-nebula-text">
      <NebulaBackground />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4" />
              {t("common.home")}
            </Button>
          </Link>
          <Link to="/app/chat">
            <Button variant="primary">{t("common.openClient")}</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-nebula-text">{t("dashboard.fullTitle")}</h1>
          <p className="mt-2 text-sm text-nebula-muted">{t("dashboard.subtitle")}</p>
        </div>
        {dashboardContent}
      </main>
    </div>
  );
}
