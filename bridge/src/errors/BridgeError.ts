export type BridgeErrorCode =
  | "INVALID_JSON"
  | "INVALID_EVENT"
  | "GATEWAY_NOT_CONNECTED"
  | "GATEWAY_TIMEOUT"
  | "GATEWAY_PACKET_ERROR"
  | "PROTO_ENCODE_FAILED"
  | "PROTO_DECODE_FAILED"
  | "AUTH_FAILED"
  | "BACKEND_ERROR"
  | "INTERNAL_ERROR";

export type BridgeErrorPayload = {
  code: BridgeErrorCode;
  message: string;
  detail?: unknown;
};

export class BridgeError extends Error {
  code: BridgeErrorCode;
  detail?: unknown;

  constructor(payload: BridgeErrorPayload) {
    super(payload.message);
    this.name = "BridgeError";
    this.code = payload.code;
    this.detail = payload.detail;
  }
}

export function toBridgeError(error: unknown, fallback: BridgeErrorPayload): BridgeError {
  if (error instanceof BridgeError) return error;
  if (error instanceof Error) {
    return new BridgeError({ ...fallback, message: error.message || fallback.message, detail: error });
  }
  return new BridgeError(fallback);
}
