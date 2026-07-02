import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  BRIDGE_HOST: z.string().default("0.0.0.0"),
  BRIDGE_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  GATEWAY_TCP_HOST: z.string().default("127.0.0.1"),
  GATEWAY_TCP_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
  USER_SERVICE_HOST: z.string().default("127.0.0.1"),
  USER_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50051),
  RELATION_SERVICE_HOST: z.string().default("127.0.0.1"),
  RELATION_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50053),
  MESSAGE_SERVICE_HOST: z.string().default("127.0.0.1"),
  MESSAGE_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50052),
  CONVERSATION_SERVICE_HOST: z.string().default("127.0.0.1"),
  CONVERSATION_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50056),
  ADMIN_SERVICE_HOST: z.string().default("127.0.0.1"),
  ADMIN_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50057),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000),
  GATEWAY_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  PROTO_DIR: z.string().default("../proto"),
  WEB_STATIC_DIR: z.string().default(""),
  MYSQL_HOST: z.string().default(""),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_USER: z.string().default(""),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().default(""),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(5)
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("NebulaIM Web Bridge configuration error:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

export const config = {
  bridgeHost: raw.BRIDGE_HOST,
  bridgePort: raw.BRIDGE_PORT,
  gatewayTcpHost: raw.GATEWAY_TCP_HOST,
  gatewayTcpPort: raw.GATEWAY_TCP_PORT,
  userServiceHost: raw.USER_SERVICE_HOST,
  userServicePort: raw.USER_SERVICE_PORT,
  relationServiceHost: raw.RELATION_SERVICE_HOST,
  relationServicePort: raw.RELATION_SERVICE_PORT,
  messageServiceHost: raw.MESSAGE_SERVICE_HOST,
  messageServicePort: raw.MESSAGE_SERVICE_PORT,
  conversationServiceHost: raw.CONVERSATION_SERVICE_HOST,
  conversationServicePort: raw.CONVERSATION_SERVICE_PORT,
  adminServiceHost: raw.ADMIN_SERVICE_HOST,
  adminServicePort: raw.ADMIN_SERVICE_PORT,
  corsOrigin: raw.CORS_ORIGIN,
  logLevel: raw.LOG_LEVEL,
  heartbeatIntervalMs: raw.HEARTBEAT_INTERVAL_MS,
  gatewayRequestTimeoutMs: raw.GATEWAY_REQUEST_TIMEOUT_MS,
  protoDir: path.resolve(process.cwd(), raw.PROTO_DIR),
  webStaticDir: raw.WEB_STATIC_DIR ? path.resolve(process.cwd(), raw.WEB_STATIC_DIR) : "",
  mysqlHost: raw.MYSQL_HOST,
  mysqlPort: raw.MYSQL_PORT,
  mysqlUser: raw.MYSQL_USER,
  mysqlPassword: raw.MYSQL_PASSWORD,
  mysqlDatabase: raw.MYSQL_DATABASE,
  mysqlConnectionLimit: raw.MYSQL_CONNECTION_LIMIT
};

export type BridgeConfig = typeof config;
