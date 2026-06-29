export type MetricSnapshot = {
  gatewayConnections: number;
  onlineUsers: number;
  messageQps: number;
  pushSuccessRate: number;
  kafkaConsumeRate: number;
  p99Latency: number;
};

export type ServiceHealthStatus = "healthy" | "degraded" | "down";

export type ServiceHealth = {
  name: string;
  status: ServiceHealthStatus;
  latency?: number;
  detail: string;
};

export type MetricsPoint = {
  time: string;
  messageQps: number;
  latency: number;
  onlineUsers: number;
};

export type DashboardEventType =
  | "admin health"
  | "system stats"
  | "outbox status"
  | "kafka lag"
  | "bridge health";

export type DashboardEvent = {
  id: string;
  type: DashboardEventType;
  service: string;
  message: string;
  createdAt: number;
};
