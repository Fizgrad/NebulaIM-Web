import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowLeft, Database, KeyRound, RefreshCw, Shield, Trash2, UsersRound } from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Input } from "../components/common/Input";
import { Spinner } from "../components/common/Spinner";
import { Logo } from "../components/brand/Logo";
import { NebulaBackground } from "../components/brand/NebulaBackground";
import { MetricCard } from "../components/dashboard/MetricCard";
import { useAdminStore } from "../store/adminStore";
import { useSettingsStore } from "../store/settingsStore";
import { useI18n } from "../i18n";

function formatAdminNumber(value?: string, locale = "en") {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return value ?? "0";
  return new Intl.NumberFormat(locale).format(numeric);
}

function healthTone(state: string) {
  const normalized = state.toLowerCase();
  if (normalized.includes("serving") && !normalized.includes("not")) return "emerald";
  if (normalized.includes("degraded")) return "amber";
  return "red";
}

function responseTone(code: number) {
  return code === 0 ? "emerald" : "amber";
}

function formatAdminTime(value: string | number, locale = "en") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "unknown";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(numeric));
}

export function AdminPage() {
  const bridgeHttpUrl = useSettingsStore((state) => state.bridgeHttpUrl);
  const { t, locale } = useI18n();
  const { adminToken, overview, cleanupResult, isLoading, error, setAdminToken, clearAdminToken, loadOverview, runCleanup } =
    useAdminStore();
  const [tokenInput, setTokenInput] = useState(adminToken);

  const totalOutbox = useMemo(() => {
    if (!overview) return 0;
    return (
      Number(overview.outboxStats.pending) +
      Number(overview.outboxStats.published) +
      Number(overview.outboxStats.failed) +
      Number(overview.outboxStats.dead)
    );
  }, [overview]);

  useEffect(() => {
    setTokenInput(adminToken);
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken.trim() || overview || isLoading) return;
    void loadOverview();
  }, [adminToken, overview, isLoading, loadOverview]);

  function handleTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminToken(tokenInput.trim());
    void loadOverview();
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

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge tone="violet">{t("admin.badge")}</Badge>
            <h1 className="mt-4 text-3xl font-semibold text-nebula-text">{t("admin.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm text-nebula-muted">
              {t("admin.subtitle")}
            </p>
          </div>
          <Badge tone="cyan">{bridgeHttpUrl}</Badge>
        </div>

        <Card className="p-5">
          <form className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]" onSubmit={handleTokenSubmit}>
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
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? <Spinner /> : <Shield className="h-4 w-4" />}
                {t("admin.connect")}
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => void loadOverview()} disabled={isLoading || !adminToken}>
                <RefreshCw className="h-4 w-4" />
                {t("common.refresh")}
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" onClick={clearAdminToken}>
                {t("common.clear")}
              </Button>
            </div>
          </form>
          {error ? <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
        </Card>

        {overview ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={t("admin.health")}
                value={overview.health.state}
                hint={overview.health.response.message}
                icon={Activity}
              />
              <MetricCard
                label={t("dashboard.onlineUsers")}
                value={formatAdminNumber(overview.systemStats.onlineUsers, locale)}
                hint={t("dashboard.systemStatsHint")}
                icon={UsersRound}
              />
              <MetricCard
                label={t("admin.connections")}
                value={formatAdminNumber(overview.systemStats.activeConnections, locale)}
                hint={t("admin.gatewaySnapshot")}
                icon={Shield}
              />
              <MetricCard
                label={t("dashboard.outboxEvents")}
                value={formatAdminNumber(String(totalOutbox), locale)}
                hint={t("dashboard.outboxHint")}
                icon={Database}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-nebula-text">{t("admin.dependencyHealth")}</h2>
                    <p className="mt-1 text-sm text-nebula-muted">{t("admin.dependencyHint")}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge tone={responseTone(overview.health.response.code)}>{overview.health.response.message}</Badge>
                    <Badge tone={healthTone(overview.health.state)}>{overview.health.state}</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {overview.health.dependencies.map((dependency) => (
                    <div key={dependency.name} className="flex items-center justify-between gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                      <div>
                        <p className="text-sm font-medium text-nebula-text">{dependency.name}</p>
                        <p className="mt-1 text-xs text-nebula-muted">{dependency.detail || t("common.noDetail")}</p>
                      </div>
                      <Badge tone={healthTone(dependency.state)}>{dependency.state}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-base font-semibold text-nebula-text">{t("admin.cleanup")}</h2>
                <p className="mt-1 text-sm text-nebula-muted">
                  {t("admin.cleanupHint")}
                </p>
                <div className="mt-4 grid gap-2">
                  <Button variant="secondary" onClick={() => void runCleanup(true)} disabled={isLoading || !adminToken}>
                    <Trash2 className="h-4 w-4" />
                    {t("admin.dryRunCleanup")}
                  </Button>
                  <Button variant="danger" onClick={() => void runCleanup(false)} disabled={isLoading || !adminToken}>
                    <Trash2 className="h-4 w-4" />
                    {t("admin.runCleanup")}
                  </Button>
                </div>
                {cleanupResult ? (
                  <div className="mt-4 rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                    <p className="text-sm font-medium text-nebula-text">{cleanupResult.response.message}</p>
                    <p className="mt-1 text-xs text-nebula-muted">{t("common.rows", { count: formatAdminNumber(cleanupResult.cleanedRows, locale) })}</p>
                  </div>
                ) : null}
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-nebula-text">{t("admin.serviceOverview")}</h2>
                    <p className="mt-1 text-sm text-nebula-muted">{t("admin.serviceOverviewHint")}</p>
                  </div>
                  <Badge tone={responseTone(overview.serviceOverview.response.code)}>{overview.serviceOverview.response.message}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {overview.serviceOverview.services.map((service) => (
                    <div key={`${service.name}-${service.address}`} className="rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-nebula-text">{service.name}</p>
                          <p className="mt-1 truncate text-xs text-nebula-muted">{service.address}</p>
                        </div>
                        <Badge tone={healthTone(service.state)}>{service.state}</Badge>
                      </div>
                      {service.detail ? <p className="mt-2 text-xs text-slate-400">{service.detail}</p> : null}
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-nebula-text">{t("admin.auditEvents")}</h2>
                    <p className="mt-1 text-sm text-nebula-muted">{t("admin.auditEventsHint")}</p>
                  </div>
                  <Badge tone={responseTone(overview.auditEvents.response.code)}>{overview.auditEvents.response.message}</Badge>
                </div>
                <div className="space-y-3">
                  {overview.auditEvents.events.length > 0 ? (
                    overview.auditEvents.events.map((event) => (
                      <div key={`${event.requestId}-${event.timestampMs}`} className="rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-nebula-text">{event.action}</p>
                            <p className="mt-1 truncate text-xs text-nebula-muted">{event.principal || t("admin.unknownPrincipal")}</p>
                          </div>
                          <Badge tone={event.decision === "allow" ? "emerald" : "red"}>{event.decision}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{event.scope || t("admin.noScope")} - {event.detail || t("common.noDetail")}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatAdminTime(event.timestampMs, locale)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-nebula-border bg-white/[0.04] p-4 text-sm text-nebula-muted">
                      {t("admin.noAuditEvents")}
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-nebula-text">{t("admin.outboxStats")}</h2>
                  <Badge tone={responseTone(overview.outboxStats.response.code)}>{overview.outboxStats.response.message}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    [t("dashboard.pending"), overview.outboxStats.pending, "amber"],
                    [t("dashboard.published"), overview.outboxStats.published, "emerald"],
                    [t("dashboard.failed"), overview.outboxStats.failed, "red"],
                    [t("dashboard.dead"), overview.outboxStats.dead, "slate"]
                  ].map(([label, value, tone]) => (
                    <div key={label} className="rounded-lg border border-nebula-border bg-white/[0.04] p-4">
                      <Badge tone={tone as "amber" | "emerald" | "red" | "slate"}>{label}</Badge>
                      <p className="mt-3 text-2xl font-semibold text-nebula-text">{formatAdminNumber(value, locale)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-nebula-text">{t("dashboard.kafkaLag")}</h2>
                  <Badge tone={responseTone(overview.kafkaLag.response.code)}>{overview.kafkaLag.response.message}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {overview.kafkaLag.lags.length > 0 ? (
                    overview.kafkaLag.lags.map((lag) => (
                      <div key={`${lag.topic}-${lag.consumerGroup}`} className="rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-nebula-text">{lag.topic}</p>
                            <p className="mt-1 text-xs text-nebula-muted">{lag.consumerGroup}</p>
                          </div>
                          <Badge tone={Number(lag.lag) > 0 ? "amber" : "emerald"}>{t("common.lag", { count: formatAdminNumber(lag.lag, locale) })}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-nebula-border bg-white/[0.04] p-4 text-sm text-nebula-muted">
                      {t("admin.noKafkaLag")}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
