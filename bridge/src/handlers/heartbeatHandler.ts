import { MessageType } from "../gateway/MessageType.js";
import type { BridgeSession, ServerEvent } from "../types/bridge.js";
import type { HeartbeatEvent } from "../types/clientEvents.js";

type ProtoHeartbeatResponse = {
  code: number;
  message: string;
  requestId: string;
};

export async function handleHeartbeat(session: BridgeSession, event: HeartbeatEvent): Promise<ServerEvent> {
  const startedAt = Date.now();
  const packet = await session.gateway.request(MessageType.HEARTBEAT_REQ, Buffer.alloc(0));
  const response = session.proto.decode<ProtoHeartbeatResponse>("nebula.proto.CommonResponse", packet.body);
  session.lastHeartbeatAt = Date.now();

  return {
    id: event.id,
    type: "connection.heartbeat_result",
    ok: response.code === 0,
    timestamp: Date.now(),
    payload: {
      ok: response.code === 0,
      code: response.code,
      message: response.message,
      requestId: response.requestId,
      latency: Date.now() - startedAt
    }
  };
}
