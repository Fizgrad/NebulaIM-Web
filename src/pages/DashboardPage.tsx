import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Gauge, Link2, Radio, Send, Server, TrendingUp } from "lucide-react";
import type { DashboardEvent, MetricSnapshot, MetricsPoint, ServiceHealth } from "../types/metrics";
import type { BridgeHealth, BridgeInfo } from "../types/bridge";
import { getMetrics, getRecentEvents, getServiceHealth } from "../api/dashboardApi";
import { getBridgeHealth, getBridgeInfo } from "../api/bridgeApi";
import { Logo } from "../components/brand/Logo";
import { NebulaBackground } from "../components/brand/NebulaBackground";
import { Button } from "../components/common/Button";
import { Spinner } from "../components/common/Spinner";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { MetricCard } from "../components/dashboard/MetricCard";
import { ServiceHealthCard } from "../components/dashboard/ServiceHealthCard";
import { MetricsChart } from "../components/dashboard/MetricsChart";
import { EventTimeline } from "../components/dashboard/EventTimeline";
import { formatNumber, formatPercent } from "../utils/format";
import { useSettingsStore } from "../store/settingsStore";
import { useChatStore } from "../store/chatStore";
import { formatShortTime } from "../utils/time";

type MetricsState = {
  snapshot: MetricSnapshot;
  series: MetricsPoint[];
};

export function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsState | null>(null);
  const [health, setHealth] = useState<ServiceHealth[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null);
  const [bridgeInfo, setBridgeInfo] = useState<BridgeInfo | null>(null);
  const [bridgeError, setBridgeError] = useState("");
  const settings = useSettingsStore();
  const gatewayStatus = useChatStore((state) => state.gatewayStatus);

  useEffect(() => {
    let mounted = true;
    Promise.all([getMetrics(), getServiceHealth(), getRecentEvents()]).then(([metricsResponse, healthResponse, eventsResponse]) => {
      if (!mounted) return;
      setMetrics(metricsResponse);
      setHealth(healthResponse);
      setEvents(eventsResponse);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
        setBridgeError(error instanceof Error ? error.message : "Bridge unavailable.");
      });
    return () => {
      mounted = false;
    };
  }, [settings.bridgeHttpUrl]);

  return (
    <div className="min-h-screen bg-nebula-bg text-nebula-text">
      <NebulaBackground />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex gap-2">
          <Link to="/">
            <Button variant="ghost">Home</Button>
          </Link>
          <Link to="/app/chat">
            <Button variant="primary">Open Client</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white">NebulaIM Dashboard</h1>
          <p className="mt-2 text-sm text-nebula-muted">Mock runtime state for Gateway, services, Kafka pipeline and storage dependencies.</p>
        </div>

        {!metrics ? (
          <div className="grid h-80 place-items-center">
            <Spinner className="h-6 w-6 text-cyan-200" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-nebula-muted">Bridge Status</p>
                    <p className="mt-3 text-2xl font-semibold text-nebula-text">{bridgeHealth?.ok ? "Online" : settings.connectionMode === "mock" ? "Mock" : "Offline"}</p>
                    <p className="mt-1 text-xs text-slate-400">{bridgeInfo?.gateway ?? bridgeError ?? settings.bridgeHttpUrl}</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                    <Link2 className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone={settings.connectionMode === "real" ? "cyan" : "slate"}>
                    Mode: {settings.connectionMode === "real" ? "Real" : "Mock"}
                  </Badge>
                  <Badge tone={gatewayStatus.state === "connected" ? "emerald" : "amber"}>
                    TCP: {gatewayStatus.state}
                  </Badge>
                  <Badge tone="violet">
                    Heartbeat: {gatewayStatus.lastHeartbeatAt ? formatShortTime(gatewayStatus.lastHeartbeatAt) : "waiting"}
                  </Badge>
                </div>
              </Card>
              <MetricCard label="Gateway Connections" value={formatNumber(metrics.snapshot.gatewayConnections)} hint="Current TCP sessions" icon={Server} />
              <MetricCard label="Online Users" value={formatNumber(metrics.snapshot.onlineUsers)} hint="Redis presence set" icon={Radio} />
              <MetricCard label="Message QPS" value={formatNumber(metrics.snapshot.messageQps)} hint="MessageService ingress" icon={Send} />
              <MetricCard label="Push Success" value={formatPercent(metrics.snapshot.pushSuccessRate)} hint="PushService delivery" icon={TrendingUp} />
              <MetricCard label="Kafka Rate" value={formatNumber(metrics.snapshot.kafkaConsumeRate)} hint="Consumer messages/s" icon={Activity} />
              <MetricCard label="P99 Latency" value={`${metrics.snapshot.p99Latency}ms`} hint="End-to-end ACK" icon={Gauge} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <MetricsChart data={metrics.series} />
              <EventTimeline events={events} />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {health.map((service) => (
                <ServiceHealthCard key={service.name} service={service} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
