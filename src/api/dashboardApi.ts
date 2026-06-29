import { metricSnapshot, metricsSeries, recentEvents, serviceHealth } from "../mocks/metrics";
import { mockRequest } from "./client";

export async function getMetrics() {
  return mockRequest(
    () => ({
      snapshot: {
        ...metricSnapshot,
        gatewayConnections: metricSnapshot.gatewayConnections + Math.floor(Math.random() * 240),
        onlineUsers: metricSnapshot.onlineUsers + Math.floor(Math.random() * 160),
        messageQps: metricSnapshot.messageQps + Math.floor(Math.random() * 280),
        p99Latency: metricSnapshot.p99Latency + Math.floor(Math.random() * 6)
      },
      series: metricsSeries
    }),
    { min: 260, max: 620 }
  );
}

export async function getServiceHealth() {
  return mockRequest(() => serviceHealth, { min: 260, max: 620 });
}

export async function getRecentEvents() {
  return mockRequest(() => recentEvents, { min: 260, max: 620 });
}
