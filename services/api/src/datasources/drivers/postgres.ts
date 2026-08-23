import type {
  DbDriver,
  IntrospectedTable,
  PostgresConnection,
} from "@repo/api/datasources/drivers/types";

const isLocalHost = (host: string) =>
  host === "localhost" || host === "127.0.0.1" || host.startsWith("::1");

const RETRY_DELAYS_MS = [500, 1500, 3000];

export async function createPostgresDriver(
  connection: PostgresConnection,
): Promise<DbDriver> {
  const { Client } = await import("pg");
  const client = new Client({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.username,
    password: connection.password,
    ssl: isLocalHost(connection.host)
      ? undefined
      : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });

  let connected = false;

  const ensureConnected = async () => {
    if (!connected) {
      await client.connect();
      connected = true;
    }
  };

  /** Retries transient network failures — mobile/hotel wifi drops packets. */
  const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        await ensureConnected();
        return await fn();
      } catch (error) {
        lastError = error;
        connected = false;
        await client.end().catch(() => undefined);
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
          );
        }
      }
    }
    throw lastError;
  };

  const quoteIdent = (identifier: string): string => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid table name: ${identifier}`);
    }
    return `"${identifier}"`;
  };

  const introspectTables = async (): Promise<IntrospectedTable[]> => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const result: IntrospectedTable[] = [];
    for (const row of tables.rows) {
      const tableName = row.table_name;
      const columns = await client.query<{
        column_name: string;
        data_type: string;
      }>(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [tableName],
      );
      let rowCount: number | null = null;
      try {
        const counted = await client.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${quoteIdent(tableName)}`,
        );
        rowCount = Number(counted.rows[0]?.n ?? 0);
      } catch {
        rowCount = null;
      }
      result.push({
        name: tableName,
        columns: columns.rows.map((c) => ({
          name: c.column_name,
          type: c.data_type,
        })),
        rowCount,
      });
    }
    return result;
  };

  return {
    async testConnection() {
      await withRetry(async () => {
        await client.query("SELECT 1");
      });
    },

    async listTables(): Promise<IntrospectedTable[]> {
      return withRetry(introspectTables);
    },

    async sampleRows(tableName, limit) {
      return withRetry(async () => {
        const rows = await client.query(
          `SELECT * FROM ${quoteIdent(tableName)} LIMIT ${Math.min(limit, 50)}`,
        );
        return rows.rows as Record<string, unknown>[];
      });
    },

    async close() {
      await client.end().catch(() => undefined);
    },
  };
}
