import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanEnv = (defaultValue: boolean) =>
  z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalized)) return true;
      if (["0", "false", "no", "off"].includes(normalized)) return false;
      return value;
    }, z.boolean())
    .default(defaultValue);

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
  DEVICE_SERVICE_HOST: z.string().default("127.0.0.1"),
  DEVICE_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50058),
  ADMIN_SERVICE_HOST: z.string().default("127.0.0.1"),
  ADMIN_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50057),
  GATEWAY_SERVICE_HOST: z.string().default("127.0.0.1"),
  GATEWAY_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(50055),
  INTERNAL_RPC_TOKEN: z.string().default(""),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(15000),
  GATEWAY_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  JSON_BODY_LIMIT: z.string().default("8mb"),
  UPLOAD_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  PROTO_DIR: z.string().default("../proto"),
  WEB_STATIC_DIR: z.string().default(""),
  MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  MEDIA_PUBLIC_BASE_URL: z.string().default(""),
  UPLOAD_DIR: z.string().default("../uploads"),
  S3_ENDPOINT: z.string().default(""),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("nebulaim-media"),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_FORCE_PATH_STYLE: booleanEnv(true),
  S3_KEY_PREFIX: z.string().default(""),
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

if (raw.MEDIA_STORAGE_DRIVER === "s3") {
  const missingS3Fields = [
    ["S3_ENDPOINT", raw.S3_ENDPOINT],
    ["S3_BUCKET", raw.S3_BUCKET],
    ["S3_ACCESS_KEY_ID", raw.S3_ACCESS_KEY_ID],
    ["S3_SECRET_ACCESS_KEY", raw.S3_SECRET_ACCESS_KEY]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingS3Fields.length > 0) {
    console.error("NebulaIM Web Bridge S3 configuration error:");
    console.error(`Missing required values for MEDIA_STORAGE_DRIVER=s3: ${missingS3Fields.join(", ")}`);
    process.exit(1);
  }
}

const mediaPublicBaseUrl = raw.MEDIA_PUBLIC_BASE_URL || (raw.MEDIA_STORAGE_DRIVER === "s3" ? "/media" : "/uploads");

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
  deviceServiceHost: raw.DEVICE_SERVICE_HOST,
  deviceServicePort: raw.DEVICE_SERVICE_PORT,
  adminServiceHost: raw.ADMIN_SERVICE_HOST,
  adminServicePort: raw.ADMIN_SERVICE_PORT,
  gatewayServiceHost: raw.GATEWAY_SERVICE_HOST,
  gatewayServicePort: raw.GATEWAY_SERVICE_PORT,
  internalRpcToken: raw.INTERNAL_RPC_TOKEN,
  corsOrigin: raw.CORS_ORIGIN,
  logLevel: raw.LOG_LEVEL,
  heartbeatIntervalMs: raw.HEARTBEAT_INTERVAL_MS,
  gatewayRequestTimeoutMs: raw.GATEWAY_REQUEST_TIMEOUT_MS,
  jsonBodyLimit: raw.JSON_BODY_LIMIT,
  uploadRateLimitPerMinute: raw.UPLOAD_RATE_LIMIT_PER_MINUTE,
  protoDir: path.resolve(process.cwd(), raw.PROTO_DIR),
  webStaticDir: raw.WEB_STATIC_DIR ? path.resolve(process.cwd(), raw.WEB_STATIC_DIR) : "",
  mediaStorageDriver: raw.MEDIA_STORAGE_DRIVER,
  mediaPublicBaseUrl,
  uploadDir: path.resolve(process.cwd(), raw.UPLOAD_DIR),
  s3Endpoint: raw.S3_ENDPOINT,
  s3Region: raw.S3_REGION,
  s3Bucket: raw.S3_BUCKET,
  s3AccessKeyId: raw.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: raw.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: raw.S3_FORCE_PATH_STYLE,
  s3KeyPrefix: raw.S3_KEY_PREFIX.trim().replace(/^\/+|\/+$/g, ""),
  mysqlHost: raw.MYSQL_HOST,
  mysqlPort: raw.MYSQL_PORT,
  mysqlUser: raw.MYSQL_USER,
  mysqlPassword: raw.MYSQL_PASSWORD,
  mysqlDatabase: raw.MYSQL_DATABASE,
  mysqlConnectionLimit: raw.MYSQL_CONNECTION_LIMIT
};

export type BridgeConfig = typeof config;
