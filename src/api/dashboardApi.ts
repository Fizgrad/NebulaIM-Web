import {
  getAdminAuditEvents,
  getAdminHealth,
  getAdminKafkaLag,
  getAdminOutboxStats,
  getAdminServiceOverview,
  getAdminSystemStats
} from "./adminApi";
import type { AdminAuditEvent, AdminCommonResponse, AdminOverview } from "../types/admin";
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
  const [health, systemStats, outboxStats, kafkaLag, serviceOverview, auditEvents] = await Promise.all([
    getAdminHealth(baseUrl, adminToken),
    getAdminSystemStats(baseUrl, adminToken),
    getAdminOutboxStats(baseUrl, adminToken),
    getAdminKafkaLag(baseUrl, adminToken),
    getAdminServiceOverview(baseUrl, adminToken),
    getAdminAuditEvents(baseUrl, adminToken, 20)
  ]);
  assertOk("HealthCheck", health.response);
  assertOk("GetSystemStats", systemStats.response);
  assertOk("GetOutboxStats", outboxStats.response);
  assertOk("GetKafkaLagInfo", kafkaLag.response);
  assertOk("GetServiceOverview", serviceOverview.response);
  assertOk("ListAuditEvents", auditEvents.response);

  const totalOutbox =
    toNumber(outboxStats.pending) + toNumber(outboxStats.published) + toNumber(outboxStats.failed) + toNumber(outboxStats.dead);
  const outboxPublishRate = totalOutbox === 0 ? 100 : (toNumber(outboxStats.published) / totalOutbox) * 100;
  const totalKafkaLag = kafkaLag.lags.reduce((sum, lag) => sum + toNumber(lag.lag), 0);
  const checkedAt = Date.now();

  return {
    overview: { health, systemStats, outboxStats, kafkaLag, serviceOverview, auditEvents },
    serviceHealth: serviceOverview.services.map((service) => ({
      name: service.name,
      status: normalizeHealthState(service.state),
      detail: `${service.address}${service.detail ? ` - ${service.detail}` : ""}`
    })),
    events: auditEvents.events.map(toDashboardEvent),
    totalOutbox,
    outboxPublishRate,
    totalKafkaLag,
    checkedAt
  };
}

function toDashboardEvent(event: AdminAuditEvent): DashboardEvent {
  return {
    id: `${event.requestId || "audit"}-${event.timestampMs}`,
    type: "admin audit",
    service: event.principal || "AdminService",
    message: `${event.action || "admin action"} ${event.decision ? `(${event.decision})` : ""}${event.detail ? ` - ${event.detail}` : ""}`,
    createdAt: Number(event.timestampMs || Date.now())
  };
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
