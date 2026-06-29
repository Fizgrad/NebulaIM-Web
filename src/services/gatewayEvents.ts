import type { ClientEvent, ClientEventType } from "../types/bridge";
import { createRequestId, getTraceId } from "../utils/trace";

export function createClientEvent<TPayload>(type: ClientEventType, payload: TPayload): ClientEvent<TPayload> {
  return {
    id: createRequestId("evt"),
    type,
    timestamp: Date.now(),
    traceId: getTraceId(),
    payload
  };
}
