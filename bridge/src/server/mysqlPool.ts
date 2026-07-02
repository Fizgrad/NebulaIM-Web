import mysql, { type Pool } from "mysql2/promise";
import { config } from "../config.js";

let cachedPool: Pool | null = null;

export function hasMysqlConfig() {
  return Boolean(config.mysqlHost && config.mysqlUser && config.mysqlDatabase);
}

export function getMysqlPool(): Pool {
  if (cachedPool) return cachedPool;
  if (!hasMysqlConfig()) {
    throw new Error("MySQL connection is not configured.");
  }

  cachedPool = mysql.createPool({
    host: config.mysqlHost,
    port: config.mysqlPort,
    user: config.mysqlUser,
    password: config.mysqlPassword,
    database: config.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: config.mysqlConnectionLimit,
    supportBigNumbers: true,
    bigNumberStrings: true
  });
  return cachedPool;
}
