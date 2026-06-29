import http from "node:http";
import cors from "cors";
import express from "express";
import type { BridgeConfig } from "../config.js";
import { createAdminRouter } from "./adminRoutes.js";

export function createHttpServer(config: BridgeConfig): http.Server {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "nebulaim-web-bridge"
    });
  });

  app.get("/info", (_req, res) => {
    res.json({
      name: "nebulaim-web-bridge",
      gateway: `${config.gatewayTcpHost}:${config.gatewayTcpPort}`,
      admin: `${config.adminServiceHost}:${config.adminServicePort}`,
      websocket: "/ws"
    });
  });

  app.use("/api/admin", createAdminRouter());

  return http.createServer(app);
}
