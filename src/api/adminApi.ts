import type {
  AdminApiEnvelope,
  AdminCleanupResult,
  AdminHealth,
  AdminKafkaLagInfo,
  AdminOutboxStats,
  AdminAuditEvents,
  AdminServiceOverview,
  AdminSystemStats
} from "../types/admin";
import { createTraceHeaders } from "../utils/trace";
import { httpClient, requestWithRetry } from "./client";

function adminHeaders(adminToken: string) {
  return {
    ...createTraceHeaders(),
    "X-Nebula-Admin-Token": adminToken
  };
}

function unwrap<T>(envelope: AdminApiEnvelope<T>) {
  if (!envelope.ok) {
    throw new Error(envelope.error?.message ?? "Admin API request failed.");
  }
  return envelope.data;
}

export async function getAdminHealth(baseUrl: string, adminToken: string) {
  const response = await requestWithRetry(
    () =>
      httpClient.get<AdminApiEnvelope<AdminHealth>>(`${baseUrl.replace(/\/$/, "")}/api/admin/health`, {
        headers: adminHeaders(adminToken)
      }),
    { retries: 1 }
  );
  return unwrap(response.data);
}

export async function getAdminSystemStats(baseUrl: string, adminToken: string) {
  const response = await requestWithRetry(
    () =>
      httpClient.get<AdminApiEnvelope<AdminSystemStats>>(`${baseUrl.replace(/\/$/, "")}/api/admin/system-stats`, {
        headers: adminHeaders(adminToken)
      }),
    { retries: 1 }
  );
  return unwrap(response.data);
}

export async function getAdminOutboxStats(baseUrl: string, adminToken: string) {
  const response = await requestWithRetry(
    () =>
      httpClient.get<AdminApiEnvelope<AdminOutboxStats>>(`${baseUrl.replace(/\/$/, "")}/api/admin/outbox-stats`, {
        headers: adminHeaders(adminToken)
      }),
    { retries: 1 }
  );
  return unwrap(response.data);
}

export async function getAdminKafkaLag(baseUrl: string, adminToken: string) {
  const response = await requestWithRetry(
    () =>
      httpClient.get<AdminApiEnvelope<AdminKafkaLagInfo>>(`${baseUrl.replace(/\/$/, "")}/api/admin/kafka-lag`, {
        headers: adminHeaders(adminToken)
      }),
    { retries: 1 }
  );
  return unwrap(response.data);
}

export async function getAdminServiceOverview(baseUrl: string, adminToken: string) {
  const response = await requestWithRetry(
    () =>
      httpClient.get<AdminApiEnvelope<AdminServiceOverview>>(`${baseUrl.replace(/\/$/, "")}/api/admin/service-overview`, {
        headers: adminHeaders(adminToken)
      }),
    { retries: 1 }
  );
  return unwrap(response.data);
}

export async function getAdminAuditEvents(baseUrl: string, adminToken: string, limit = 20) {
  const response = await requestWithRetry(
    () =>
      httpClient.get<AdminApiEnvelope<AdminAuditEvents>>(`${baseUrl.replace(/\/$/, "")}/api/admin/audit-events`, {
        headers: adminHeaders(adminToken),
        params: { limit }
      }),
    { retries: 1 }
  );
  return unwrap(response.data);
}

export async function runAdminCleanup(baseUrl: string, adminToken: string, dryRun: boolean) {
  const response = await requestWithRetry(
    () =>
      httpClient.post<AdminApiEnvelope<AdminCleanupResult>>(
        `${baseUrl.replace(/\/$/, "")}/api/admin/cleanup`,
        { dryRun },
        { headers: adminHeaders(adminToken) }
      ),
    { retries: 0 }
  );
  return unwrap(response.data);
}
