export type AdminCommonResponse = {
  code: number;
  message: string;
  requestId: string;
};

export type AdminDependencyHealth = {
  name: string;
  state: string;
  detail: string;
};

export type AdminHealth = {
  response: AdminCommonResponse;
  state: string;
  dependencies: AdminDependencyHealth[];
};

export type AdminSystemStats = {
  response: AdminCommonResponse;
  onlineUsers: string;
  activeConnections: string;
};

export type AdminOutboxStats = {
  response: AdminCommonResponse;
  pending: string;
  published: string;
  failed: string;
  dead: string;
};

export type AdminKafkaLag = {
  topic: string;
  consumerGroup: string;
  lag: string;
};

export type AdminKafkaLagInfo = {
  response: AdminCommonResponse;
  lags: AdminKafkaLag[];
};

export type AdminServiceOverviewItem = {
  name: string;
  address: string;
  state: string;
  detail: string;
};

export type AdminServiceOverview = {
  response: AdminCommonResponse;
  services: AdminServiceOverviewItem[];
};

export type AdminAuditEvent = {
  timestampMs: string | number;
  requestId: string;
  principal: string;
  action: string;
  scope: string;
  decision: string;
  detail: string;
};

export type AdminAuditEvents = {
  response: AdminCommonResponse;
  events: AdminAuditEvent[];
};

export type AdminCleanupResult = {
  response: AdminCommonResponse;
  cleanedRows: string;
};

export type AdminOverview = {
  health: AdminHealth;
  systemStats: AdminSystemStats;
  outboxStats: AdminOutboxStats;
  kafkaLag: AdminKafkaLagInfo;
  serviceOverview: AdminServiceOverview;
  auditEvents: AdminAuditEvents;
};

export type AdminApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
};
