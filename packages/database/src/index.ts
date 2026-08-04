import "dotenv/config";

import { setDefaultResultOrder } from "node:dns";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@repo/database/schema";

// Neon resolves to both IPv6 and IPv4; without IPv4-first, Node's fetch may
// pick IPv6, which has no route on some machines, and every query times out.
setDefaultResultOrder("ipv4first");

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

// Transient network failures should be retried rather than surfaced to the
// caller (flaky hotspots, AWS region blips, etc.).
function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|ETIMEDOUT|ENETUNREACH|ECONNRESET|EAI_AGAIN/.test(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(connectionString);

const runWithRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isTransientError(error)) {
        throw error;
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      attempt++;
    }
  }
};

const sqlWithRetry = Object.assign(
  (strings: TemplateStringsArray, ...params: unknown[]) =>
    runWithRetry(() => sql(strings, ...params)),
  {
    query: (query: string, params?: unknown[], options?: Parameters<typeof sql.query>[2]) =>
      runWithRetry(() => sql.query(query, params, options)),
  },
) as unknown as typeof sql;

export const db = drizzle(sqlWithRetry, { schema });

export type Database = typeof db;

export { schema };