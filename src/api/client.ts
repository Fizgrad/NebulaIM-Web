import axios from "axios";
import { createTraceHeaders } from "../utils/trace";
import { retryWithBackoff, isTransientError, type RetryOptions } from "../utils/retry";
import { clientLogger } from "../services/clientLogger";

export type ApiErrorPayload = {
  code: string;
  message: string;
};

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(payload: ApiErrorPayload, status = 400) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
  }
}

export const httpClient = axios.create({
  timeout: 8000,
  headers: {
    "Content-Type": "application/json"
  }
});

function getPersistedToken() {
  try {
    const raw = window.localStorage.getItem("nebulaim-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

httpClient.interceptors.request.use((config) => {
  const requestId = config.headers.get?.("X-Request-Id") ?? undefined;
  const traceHeaders = createTraceHeaders(typeof requestId === "string" ? requestId : undefined);
  config.headers.set("X-Request-Id", traceHeaders["X-Request-Id"]);
  config.headers.set("X-Trace-Id", traceHeaders["X-Trace-Id"]);

  const token = getPersistedToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  clientLogger.debug(`HTTP ${config.method?.toUpperCase() ?? "GET"} ${config.url}`, undefined, traceHeaders["X-Request-Id"]);
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    clientLogger.warn("HTTP request failed", error);
    return Promise.reject(error);
  }
);

export function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function requestWithRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}) {
  return retryWithBackoff(operation, {
    retries: options.retries ?? 2,
    baseDelayMs: options.baseDelayMs ?? 300,
    maxDelayMs: options.maxDelayMs ?? 2000,
    shouldRetry: options.shouldRetry ?? isTransientError,
    onRetry: (error, attempt, waitMs) => {
      clientLogger.warn(`Retrying request attempt=${attempt} wait=${waitMs}ms`, error);
      options.onRetry?.(error, attempt, waitMs);
    }
  });
}
