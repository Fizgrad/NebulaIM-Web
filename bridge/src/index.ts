import type { Socket } from "node:net";
import { config } from "./config.js";
import { createHttpServer } from "./server/httpServer.js";
import { logger } from "./utils/logger.js";

async function main() {
  const server = createHttpServer(config);
  const sockets = new Set<Socket>();

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });
  });

  server.listen(config.bridgePort, config.bridgeHost, () => {
    logger.info(`NebulaIM Web HTTP bridge listening on ${config.bridgeHost}:${config.bridgePort}`);
    logger.info(`Gateway WebSocket target ${config.gatewayTcpHost}:${config.gatewayTcpPort}`);
  });

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info("NebulaIM Web Bridge shutting down");
    server.close(() => process.exit(0));
    server.closeIdleConnections();

    setTimeout(() => {
      server.closeAllConnections();
      for (const socket of sockets) {
        socket.destroy();
      }
    }, 1000).unref();

    setTimeout(() => process.exit(0), 8000).unref();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error("Bridge startup failed", { detail: error });
  process.exit(1);
});
