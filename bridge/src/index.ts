import { config } from "./config.js";
import { createHttpServer } from "./server/httpServer.js";
import { logger } from "./utils/logger.js";

async function main() {
  const server = createHttpServer(config);

  server.listen(config.bridgePort, config.bridgeHost, () => {
    logger.info(`NebulaIM Web HTTP bridge listening on ${config.bridgeHost}:${config.bridgePort}`);
    logger.info(`Gateway WebSocket target ${config.gatewayTcpHost}:${config.gatewayTcpPort}`);
  });

  const shutdown = () => {
    logger.info("NebulaIM Web Bridge shutting down");
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error("Bridge startup failed", { detail: error });
  process.exit(1);
});
