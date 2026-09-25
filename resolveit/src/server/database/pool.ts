import "server-only";
import { Pool } from "pg";
import { requireDatabaseUrl } from "@/server/config/env";

const globalForPool = globalThis as typeof globalThis & { resolveItPool?: Pool };

export function getDatabasePool(): Pool {
  globalForPool.resolveItPool ??= new Pool({
    connectionString: requireDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return globalForPool.resolveItPool;
}
