import type http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "../config.js";
import { BridgeError } from "../errors/BridgeError.js";
import { TcpGatewayClient } from "../gateway/TcpGatewayClient.js";
import { handleClientMessage } from "../handlers/clientMessageHandler.js";
import { handleGatewayPacket } from "../handlers/gatewayMessageHandler.js";
import type { ProtoRegistry } from "../proto/loadProto.js";
import type { BridgeSession, ServerEvent } from "../types/bridge.js";
import { createId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

export function attachWebSocketServer(server: http.Server, proto: ProtoRegistry): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    const sessionId = createId("session");
    const gateway = new TcpGatewayClient({
      host: config.gatewayTcpHost,
      port: config.gatewayTcpPort,
      timeoutMs: config.gatewayRequestTimeoutMs,
      sessionId
    });

    const session: BridgeSession = {
      id: sessionId,
      ws,
      gateway,
      proto,
      connectedAt: Date.now(),
      send: (event) => sendJson(ws, event)
    };

    logger.info("WebSocket connected", { sessionId });

    gateway.onPush((packet) => handleGatewayPacket(session, packet));
    gateway.onClose(() => {
      sendJson(ws, {
        id: createId("status"),
        type: "connection.status",
        ok: false,
        timestamp: Date.now(),
        payload: {
          state: "disconnected",
          gatewayConnected: false
        },
        error: {
          code: 503,
          message: "Gateway TCP connection closed."
        }
      });
    });

    gateway
      .connect()
      .then(() => {
        sendJson(ws, {
          id: createId("status"),
          type: "connection.status",
          ok: true,
          timestamp: Date.now(),
          payload: {
            state: "connected",
            gatewayConnected: true,
            gateway: `${config.gatewayTcpHost}:${config.gatewayTcpPort}`
          }
        });
      })
      .catch((error) => {
        logger.error("TCP Gateway connect failed", { sessionId, detail: error });
        sendJson(ws, {
          id: createId("status"),
          type: "connection.status",
          ok: false,
          timestamp: Date.now(),
          payload: {
            state: "disconnected",
            gatewayConnected: false
          },
          error: {
            code: 503,
            message: "Bridge could not connect to NebulaIM Gateway."
          }
        });
      });

    ws.on("message", async (data) => {
      const raw = parseClientJson(data.toString());
      if (raw instanceof BridgeError) {
        sendJson(ws, {
          id: "invalid",
          type: "error",
          ok: false,
          timestamp: Date.now(),
          error: {
            code: 400,
            message: raw.message
          }
        });
        return;
      }

      const response = await handleClientMessage(session, raw);
      sendJson(ws, response);
    });

    ws.on("pong", () => {
      session.lastHeartbeatAt = Date.now();
    });

    ws.on("close", () => {
      logger.info("WebSocket closed", { sessionId });
      gateway.close();
    });

    ws.on("error", (error) => {
      logger.warn("WebSocket error", { sessionId, detail: error });
      gateway.close();
    });
  });

  const pingTimer = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.ping();
      }
    }
  }, config.heartbeatIntervalMs);

  wss.on("close", () => {
    clearInterval(pingTimer);
  });

  return wss;
}

function parseClientJson(text: string): unknown | BridgeError {
  try {
    return JSON.parse(text);
  } catch {
    return new BridgeError({
      code: "INVALID_JSON",
      message: "WebSocket message must be valid JSON."
    });
  }
}

function sendJson(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}
