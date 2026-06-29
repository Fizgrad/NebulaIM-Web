import { getTraceId } from "../utils/trace";

export type ClientLogLevel = "debug" | "info" | "warn" | "error";

export type ClientLogEntry = {
  level: ClientLogLevel;
  message: string;
  traceId: string;
  requestId?: string;
  timestamp: number;
  detail?: unknown;
};

const entries: ClientLogEntry[] = [];
const maxEntries = 200;

function sanitize(detail: unknown) {
  if (detail instanceof Error) {
    return { name: detail.name, message: detail.message };
  }
  if (typeof detail === "string") {
    return detail.length > 300 ? `${detail.slice(0, 300)}...` : detail;
  }
  return detail;
}

function write(level: ClientLogLevel, message: string, detail?: unknown, requestId?: string) {
  const entry: ClientLogEntry = {
    level,
    message,
    traceId: getTraceId(),
    requestId,
    timestamp: Date.now(),
    detail: sanitize(detail)
  };
  entries.unshift(entry);
  entries.splice(maxEntries);

  const consoleMethod = level === "debug" ? "debug" : level;
  console[consoleMethod](`[NebulaIM][${level}] trace=${entry.traceId}${requestId ? ` request=${requestId}` : ""} ${message}`, entry.detail ?? "");
}

export const clientLogger = {
  debug: (message: string, detail?: unknown, requestId?: string) => write("debug", message, detail, requestId),
  info: (message: string, detail?: unknown, requestId?: string) => write("info", message, detail, requestId),
  warn: (message: string, detail?: unknown, requestId?: string) => write("warn", message, detail, requestId),
  error: (message: string, detail?: unknown, requestId?: string) => write("error", message, detail, requestId),
  getEntries: () => [...entries],
  clear: () => {
    entries.splice(0, entries.length);
  }
};
