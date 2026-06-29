import {
  getAdminHealth,
  getAdminKafkaLag,
  getAdminOutboxStats,
  getAdminSystemStats
} from "./adminApi";
import type { AdminCommonResponse, AdminOverview } from "../types/admin";
import type { DashboardEvent, ServiceHealth, ServiceHealthStatus } from "../types/metrics";

export type DashboardRuntime = {
  overview: AdminOverview;
  serviceHealth: ServiceHealth[];
  events: DashboardEvent[];
  totalOutbox: number;
  outboxPublishRate: number;
  totalKafkaLag: number;
  checkedAt: number;
};

export async function getDashboardRuntime(baseUrl: string, adminToken: string): Promise<DashboardRuntime> {
  const [health, systemStats, outboxStats, kafkaLag] = await Promise.all([
    getAdminHealth(baseUrl, adminToken),
    getAdminSystemStats(baseUrl, adminToken),
    getAdminOutboxStats(baseUrl, adminToken),
    getAdminKafkaLag(baseUrl, adminToken)
  ]);
  assertOk("HealthCheck", health.response);
  assertOk("GetSystemStats", systemStats.response);
  assertOk("GetOutboxStats", outboxStats.response);
  assertOk("GetKafkaLagInfo", kafkaLag.response);

  const totalOutbox =
    toNumber(outboxStats.pending) + toNumber(outboxStats.published) + toNumber(outboxStats.failed) + toNumber(outboxStats.dead);
  const outboxPublishRate = totalOutbox === 0 ? 100 : (toNumber(outboxStats.published) / totalOutbox) * 100;
  const totalKafkaLag = kafkaLag.lags.reduce((sum, lag) => sum + toNumber(lag.lag), 0);
  const checkedAt = Date.now();

  return {
    overview: { health, systemStats, outboxStats, kafkaLag },
    serviceHealth: health.dependencies.map((dependency) => ({
      name: dependency.name,
      status: normalizeHealthState(dependency.state),
      detail: dependency.detail || dependency.state
    })),
    events: buildEvents({ health, systemStats, outboxStats, kafkaLag }, totalOutbox, totalKafkaLag, checkedAt),
    totalOutbox,
    outboxPublishRate,
    totalKafkaLag,
    checkedAt
  };
}

function buildEvents(overview: AdminOverview, totalOutbox: number, totalKafkaLag: number, checkedAt: number): DashboardEvent[] {
  return [
    {
      id: `${overview.health.response.requestId || "health"}-${checkedAt}`,
      type: "admin health",
      service: "AdminService",
      message: `HealthCheck returned ${overview.health.state} with ${overview.health.dependencies.length} dependencies.`,
      createdAt: checkedAt
    },
    {
      id: `${overview.systemStats.response.requestId || "system"}-${checkedAt}`,
      type: "system stats",
      service: "Gateway",
      message: `${formatRaw(overview.systemStats.activeConnections)} active connections, ${formatRaw(overview.systemStats.onlineUsers)} online users.`,
      createdAt: checkedAt - 1000
    },
    {
      id: `${overview.outboxStats.response.requestId || "outbox"}-${checkedAt}`,
      type: "outbox status",
      service: "MySQL",
      message: `${formatRaw(totalOutbox)} outbox events: ${formatRaw(overview.outboxStats.pending)} pending, ${formatRaw(overview.outboxStats.failed)} failed.`,
      createdAt: checkedAt - 2000
    },
    {
      id: `${overview.kafkaLag.response.requestId || "kafka"}-${checkedAt}`,
      type: "kafka lag",
      service: "Kafka",
      message:
        overview.kafkaLag.lags.length > 0
          ? `${formatRaw(totalKafkaLag)} total lag across ${overview.kafkaLag.lags.length} consumer groups.`
          : "No Kafka lag entries returned by AdminService.",
      createdAt: checkedAt - 3000
    }
  ];
}

function normalizeHealthState(state: string): ServiceHealthStatus {
  const normalized = state.toLowerCase();
  if ((normalized.includes("serving") || normalized.includes("healthy") || normalized === "ok") && !normalized.includes("not")) {
    return "healthy";
  }
  if (normalized.includes("degraded") || normalized.includes("warning")) return "degraded";
  return "down";
}

function assertOk(operation: string, response: AdminCommonResponse) {
  if (response.code !== 0) {
    throw new Error(`${operation} failed: ${response.message || `code ${response.code}`}`);
  }
}

function toNumber(value: string | number | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatRaw(value: string | number) {
  return new Intl.NumberFormat("en").format(toNumber(value));
}
