import { config } from "../config.js";
import { formatLogTime } from "./time.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function shouldLog(level: LogLevel): boolean {
  return levelRank[level] >= levelRank[config.logLevel];
}

function write(level: LogLevel, message: string, context?: { sessionId?: string; detail?: unknown }): void {
  if (!shouldLog(level)) return;
  const session = context?.sessionId ? ` [session=${context.sessionId}]` : "";
  const detail = context?.detail === undefined ? "" : ` ${safeDetail(context.detail)}`;
  console[level === "debug" ? "log" : level](`${formatLogTime()} [${level.toUpperCase()}]${session} ${message}${detail}`);
}

function safeDetail(detail: unknown): string {
  if (detail instanceof Error) return detail.stack ?? detail.message;
  if (typeof detail === "string") return detail.length > 300 ? `${detail.slice(0, 300)}...` : detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export const logger = {
  debug: (message: string, context?: { sessionId?: string; detail?: unknown }) => write("debug", message, context),
  info: (message: string, context?: { sessionId?: string; detail?: unknown }) => write("info", message, context),
  warn: (message: string, context?: { sessionId?: string; detail?: unknown }) => write("warn", message, context),
  error: (message: string, context?: { sessionId?: string; detail?: unknown }) => write("error", message, context)
};
