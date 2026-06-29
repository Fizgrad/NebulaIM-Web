import { createId } from "./id";

const TRACE_STORAGE_KEY = "nebulaim-trace-id";

export function getTraceId() {
  const existing = window.sessionStorage.getItem(TRACE_STORAGE_KEY);
  if (existing) return existing;
  const traceId = createId("trace");
  window.sessionStorage.setItem(TRACE_STORAGE_KEY, traceId);
  return traceId;
}

export function createRequestId(prefix = "req") {
  return createId(prefix);
}

export function createTraceHeaders(requestId = createRequestId()) {
  return {
    "X-Request-Id": requestId,
    "X-Trace-Id": getTraceId()
  };
}
