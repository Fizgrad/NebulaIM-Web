import type { DashboardEvent, MetricSnapshot, MetricsPoint, ServiceHealth } from "../types/metrics";

const now = Date.now();

export const metricSnapshot: MetricSnapshot = {
  gatewayConnections: 18432,
  onlineUsers: 12608,
  messageQps: 4821,
  pushSuccessRate: 99.93,
  kafkaConsumeRate: 7630,
  p99Latency: 38
};

export const metricsSeries: MetricsPoint[] = [
  { time: "10:00", messageQps: 3820, latency: 30, onlineUsers: 11240 },
  { time: "10:05", messageQps: 4200, latency: 34, onlineUsers: 11680 },
  { time: "10:10", messageQps: 4560, latency: 35, onlineUsers: 12090 },
  { time: "10:15", messageQps: 4380, latency: 33, onlineUsers: 11970 },
  { time: "10:20", messageQps: 4920, latency: 38, onlineUsers: 12608 },
  { time: "10:25", messageQps: 5100, latency: 36, onlineUsers: 12890 },
  { time: "10:30", messageQps: 4821, latency: 38, onlineUsers: 12608 }
];

export const serviceHealth: ServiceHealth[] = [
  { name: "Gateway", status: "healthy", latency: 18, detail: "TCP long connections stable" },
  { name: "UserService", status: "healthy", latency: 12, detail: "gRPC 50051 responding" },
  { name: "RelationService", status: "healthy", latency: 15, detail: "gRPC 50053 responding" },
  { name: "MessageService", status: "healthy", latency: 20, detail: "gRPC 50052 responding" },
  { name: "PushService", status: "degraded", latency: 44, detail: "Kafka retry queue active" },
  { name: "MySQL", status: "healthy", latency: 8, detail: "Persistence OK" },
  { name: "Redis", status: "healthy", latency: 4, detail: "Presence cache OK" },
  { name: "Kafka", status: "healthy", latency: 16, detail: "Consumer lag controlled" }
];

export const recentEvents: DashboardEvent[] = [
  {
    id: "e-1",
    type: "user login",
    service: "Gateway",
    message: "u-alice authenticated through gateway-shanghai-01",
    createdAt: now - 1000 * 18
  },
  {
    id: "e-2",
    type: "message sent",
    service: "MessageService",
    message: "message persisted and ACK sent to client",
    createdAt: now - 1000 * 42
  },
  {
    id: "e-3",
    type: "push delivered",
    service: "PushService",
    message: "offline push delivered to u-charlie",
    createdAt: now - 1000 * 60 * 2
  },
  {
    id: "e-4",
    type: "kafka retry",
    service: "Kafka",
    message: "retry topic consumed after transient network jitter",
    createdAt: now - 1000 * 60 * 4
  },
  {
    id: "e-5",
    type: "offline saved",
    service: "MySQL",
    message: "offline message saved for disconnected session",
    createdAt: now - 1000 * 60 * 6
  }
];
