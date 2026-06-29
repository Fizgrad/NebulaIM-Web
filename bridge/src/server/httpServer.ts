import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import type { BridgeConfig } from "../config.js";
import { createAdminRouter } from "./adminRoutes.js";
import { createAuthRouter } from "./authRoutes.js";

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
      user: `${config.userServiceHost}:${config.userServicePort}`,
      admin: `${config.adminServiceHost}:${config.adminServicePort}`,
      websocket: "/ws"
    });
  });

  app.use("/api/auth", createAuthRouter());
  app.use("/api/admin", createAdminRouter());

  if (config.webStaticDir && fs.existsSync(path.join(config.webStaticDir, "index.html"))) {
    app.use(express.static(config.webStaticDir, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/ws") {
        next();
        return;
      }
      res.sendFile(path.join(config.webStaticDir, "index.html"));
    });
  }

  return http.createServer(app);
}
