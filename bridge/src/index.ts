import { config } from "./config.js";
import { createHttpServer } from "./server/httpServer.js";
import { attachWebSocketServer } from "./server/wsServer.js";
import { ProtoRegistry } from "./proto/loadProto.js";
import { logger } from "./utils/logger.js";

async function main() {
  const proto = new ProtoRegistry();
  await proto.load();
  logger.info(`Protobuf loaded from ${config.protoDir}`);

  const server = createHttpServer(config);
  attachWebSocketServer(server, proto);

  server.listen(config.bridgePort, config.bridgeHost, () => {
    logger.info(`NebulaIM Web Bridge listening on ${config.bridgeHost}:${config.bridgePort}`);
    logger.info(`Gateway target ${config.gatewayTcpHost}:${config.gatewayTcpPort}`);
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
