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

function formatAdminNumber(value?: string) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return value ?? "0";
  return new Intl.NumberFormat("en").format(numeric);
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

function formatAdminTime(value: string | number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(numeric));
}

export function AdminPage() {
  const bridgeHttpUrl = useSettingsStore((state) => state.bridgeHttpUrl);
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
              Home
            </Button>
          </Link>
          <Link to="/app/chat">
            <Button variant="primary">Open Client</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-5 py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge tone="violet">AdminService gRPC via Bridge</Badge>
            <h1 className="mt-4 text-3xl font-semibold text-nebula-text">NebulaIM Admin</h1>
            <p className="mt-2 max-w-2xl text-sm text-nebula-muted">
              Token-protected operations for health checks, system stats, outbox status, Kafka lag and bounded cleanup. AdminService
              authorizes each RPC by scope through gRPC metadata.
            </p>
          </div>
          <Badge tone="cyan">{bridgeHttpUrl}</Badge>
        </div>

        <Card className="p-5">
          <form className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]" onSubmit={handleTokenSubmit}>
            <Input
              label="Admin Token"
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="AdminService token"
              autoComplete="off"
              icon={<KeyRound className="h-4 w-4" />}
            />
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={isLoading}>
                {isLoading ? <Spinner /> : <Shield className="h-4 w-4" />}
                Connect
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={() => void loadOverview()} disabled={isLoading || !adminToken}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="ghost" onClick={clearAdminToken}>
                Clear
              </Button>
            </div>
          </form>
          {error ? <div className="mt-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
        </Card>

        {overview ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Admin Health"
                value={overview.health.state}
                hint={overview.health.response.message}
                icon={Activity}
              />
              <MetricCard
                label="Online Users"
                value={formatAdminNumber(overview.systemStats.onlineUsers)}
                hint="AdminService GetSystemStats"
                icon={UsersRound}
              />
              <MetricCard
                label="Connections"
                value={formatAdminNumber(overview.systemStats.activeConnections)}
                hint="Gateway connection snapshot"
                icon={Shield}
              />
              <MetricCard
                label="Outbox Events"
                value={formatAdminNumber(String(totalOutbox))}
                hint="pending + published + failed + dead"
                icon={Database}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-nebula-text">Dependency Health</h2>
                    <p className="mt-1 text-sm text-nebula-muted">AdminService HealthCheck dependencies.</p>
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
                        <p className="mt-1 text-xs text-nebula-muted">{dependency.detail || "No detail"}</p>
                      </div>
                      <Badge tone={healthTone(dependency.state)}>{dependency.state}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="text-base font-semibold text-nebula-text">Cleanup</h2>
                <p className="mt-1 text-sm text-nebula-muted">
                  Requires `cleanup` scope. Run dry-run first. Real cleanup is bounded by backend config.
                </p>
                <div className="mt-4 grid gap-2">
                  <Button variant="secondary" onClick={() => void runCleanup(true)} disabled={isLoading || !adminToken}>
                    <Trash2 className="h-4 w-4" />
                    Dry Run Cleanup
                  </Button>
                  <Button variant="danger" onClick={() => void runCleanup(false)} disabled={isLoading || !adminToken}>
                    <Trash2 className="h-4 w-4" />
                    Run Cleanup
                  </Button>
                </div>
                {cleanupResult ? (
                  <div className="mt-4 rounded-lg border border-nebula-border bg-white/[0.04] p-3">
                    <p className="text-sm font-medium text-nebula-text">{cleanupResult.response.message}</p>
                    <p className="mt-1 text-xs text-nebula-muted">Rows: {formatAdminNumber(cleanupResult.cleanedRows)}</p>
                  </div>
                ) : null}
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-nebula-text">Service Overview</h2>
                    <p className="mt-1 text-sm text-nebula-muted">AdminService GetServiceOverview.</p>
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
                    <h2 className="text-base font-semibold text-nebula-text">Audit Events</h2>
                    <p className="mt-1 text-sm text-nebula-muted">AdminService ListAuditEvents.</p>
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
                            <p className="mt-1 truncate text-xs text-nebula-muted">{event.principal || "unknown principal"}</p>
                          </div>
                          <Badge tone={event.decision === "allow" ? "emerald" : "red"}>{event.decision}</Badge>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{event.scope || "no scope"} - {event.detail || "no detail"}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatAdminTime(event.timestampMs)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-nebula-border bg-white/[0.04] p-4 text-sm text-nebula-muted">
                      No audit events returned by AdminService.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-nebula-text">Outbox Stats</h2>
                  <Badge tone={responseTone(overview.outboxStats.response.code)}>{overview.outboxStats.response.message}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    ["Pending", overview.outboxStats.pending, "amber"],
                    ["Published", overview.outboxStats.published, "emerald"],
                    ["Failed", overview.outboxStats.failed, "red"],
                    ["Dead", overview.outboxStats.dead, "slate"]
                  ].map(([label, value, tone]) => (
                    <div key={label} className="rounded-lg border border-nebula-border bg-white/[0.04] p-4">
                      <Badge tone={tone as "amber" | "emerald" | "red" | "slate"}>{label}</Badge>
                      <p className="mt-3 text-2xl font-semibold text-nebula-text">{formatAdminNumber(value)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-nebula-text">Kafka Lag</h2>
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
                          <Badge tone={Number(lag.lag) > 0 ? "amber" : "emerald"}>lag {formatAdminNumber(lag.lag)}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-nebula-border bg-white/[0.04] p-4 text-sm text-nebula-muted">
                      No Kafka lag entries returned by AdminService.
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
