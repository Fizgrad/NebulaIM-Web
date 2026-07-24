import http from "node:http";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import cors from "cors";
import express from "express";
import type { BridgeConfig } from "../config.js";
import { createAdminRouter } from "./adminRoutes.js";
import { createAuthRouter } from "./authRoutes.js";
import { createConversationRouter } from "./conversationRoutes.js";
import { createDeviceRouter } from "./deviceRoutes.js";
import { createMessageRouter } from "./messageRoutes.js";
import { createMediaRouter } from "./mediaRoutes.js";
import { createPresenceRouter } from "./presenceRoutes.js";
import { createRelationRouter } from "./relationRoutes.js";
import { createUploadRouter } from "./uploadRoutes.js";
import { requireBridgeAuth } from "./authMiddleware.js";

export function createHttpServer(config: BridgeConfig): http.Server {
  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      }
    })
  );
  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "nebulaim-web-bridge"
    });
  });

  app.get("/info", (_req, res) => {
    res.json({
      name: "nebulaim-web-bridge",
      websocket: "/ws"
    });
  });

  const bridgeAuth = requireBridgeAuth();
  app.use("/api/auth/users", bridgeAuth);
  app.use("/api/auth", createAuthRouter());
  app.use("/api/messages", bridgeAuth, createMessageRouter());
  app.use("/api/relation", bridgeAuth, createRelationRouter());
  app.use("/api/conversations", bridgeAuth, createConversationRouter());
  app.use("/api/devices", bridgeAuth, createDeviceRouter());
  app.use("/api/presence", bridgeAuth, createPresenceRouter());
  app.use("/api/uploads", bridgeAuth, createUploadRouter());
  app.use("/api/admin", createAdminRouter());

  if (config.mediaStorageDriver === "s3") {
    app.use("/media", createMediaRouter());
  }

  app.use(
    "/uploads",
    express.static(config.uploadDir, {
      index: false,
      immutable: true,
      maxAge: "30d"
    })
  );

  if (config.webStaticDir && fs.existsSync(path.join(config.webStaticDir, "index.html"))) {
    app.use(
      express.static(config.webStaticDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (path.basename(filePath) === "index.html") {
            res.setHeader("Cache-Control", "no-cache");
            return;
          }
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(config.webStaticDir, "index.html"));
    });
  }

  const server = http.createServer(app);
  attachGatewayWebSocketProxy(server, config);
  return server;
}

function attachGatewayWebSocketProxy(server: http.Server, config: BridgeConfig) {
  const gatewayTlsOptions = config.gatewayTcpTlsEnabled
    ? {
        ca: fs.readFileSync(config.gatewayTcpTlsCaFile),
        cert: config.gatewayTcpTlsCertFile ? fs.readFileSync(config.gatewayTcpTlsCertFile) : undefined,
        key: config.gatewayTcpTlsKeyFile ? fs.readFileSync(config.gatewayTcpTlsKeyFile) : undefined,
        servername: config.gatewayTcpTlsServerName || config.gatewayTcpHost,
        rejectUnauthorized: true
      }
    : null;

  server.on("upgrade", (req, socket, head) => {
    const pathname = parsePathname(req.url);
    if (pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const upstream = gatewayTlsOptions
      ? tls.connect({
          host: config.gatewayTcpHost,
          port: config.gatewayTcpPort,
          ...gatewayTlsOptions
        })
      : net.connect(config.gatewayTcpPort, config.gatewayTcpHost);
    let connected = false;

    const handleConnected = () => {
      connected = true;
      upstream.setTimeout(0);
      upstream.write(formatUpgradeRequest(req));
      if (head.length > 0) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    };
    if (gatewayTlsOptions) {
      upstream.once("secureConnect", handleConnected);
    } else {
      upstream.once("connect", handleConnected);
    }
    upstream.setTimeout(config.gatewayRequestTimeoutMs, () => {
      upstream.destroy(new Error("Gateway connection timed out."));
    });

    upstream.on("error", () => {
      if (!connected && !socket.destroyed) {
        socket.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
      }
      socket.destroy();
    });

    socket.on("error", () => {
      upstream.destroy();
    });

    socket.on("close", () => {
      upstream.destroy();
    });
  });
}

function parsePathname(url: string | undefined) {
  try {
    return new URL(url ?? "/", "http://nebulaim.local").pathname;
  } catch {
    return "/";
  }
}

function formatUpgradeRequest(req: http.IncomingMessage) {
  const target = req.url && req.url.length > 0 ? req.url : "/";
  const lines = [`${req.method ?? "GET"} ${target} HTTP/${req.httpVersion}`];
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
  }
  lines.push("", "");
  return lines.join("\r\n");
}
