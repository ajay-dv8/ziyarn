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
  const clientConfig = {
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
  };

  /**
   * Runs fn with a dedicated client, retrying transient network failures on
   * brand-new connections — pg Clients cannot be reused after end(), so each
   * attempt gets its own.
   */
  const describeError = (error: unknown): string => {
    if (error instanceof Error) {
      const code = (error as NodeJS.ErrnoException).code;
      const base = error.message || code || error.name || "unknown error";
      return code && !base.includes(code) ? `${base} (${code})` : base;
    }
    return String(error);
  };

  const withClient = async <T>(
    fn: (client: InstanceType<typeof Client>) => Promise<T>,
  ): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const client = new Client(clientConfig);
      try {
        await client.connect();
        return await fn(client);
      } catch (error) {
        lastError = error;
        console.error(
          `[postgres-driver] attempt ${attempt + 1} failed:`,
          error,
        );
      } finally {
        await client.end().catch(() => undefined);
      }
      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
        );
      }
    }
    throw new Error(describeError(lastError));
  };

  const quoteIdent = (identifier: string): string => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid table name: ${identifier}`);
    }
    return `"${identifier}"`;
  };

  type Queryable = InstanceType<typeof Client>;

  const introspectTables = async (
    client: Queryable,
  ): Promise<IntrospectedTable[]> => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const result: IntrospectedTable[] = [];
    for (const row of tables.rows) {
      const tableName = row.table_name;
      // Per-table failures (transient network drops) degrade gracefully
      // instead of aborting the whole introspection.
      let columns: IntrospectedTable["columns"] = [];
      try {
        const cols = await client.query<{
          column_name: string;
          data_type: string;
        }>(
          `SELECT column_name, data_type FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [tableName],
        );
        columns = cols.rows.map((c) => ({
          name: c.column_name,
          type: c.data_type,
        }));
      } catch {
        columns = [];
      }
      let rowCount: number | null = null;
      try {
        const counted = await client.query<{ n: string }>(
          `SELECT count(*) AS n FROM ${quoteIdent(tableName)}`,
        );
        rowCount = Number(counted.rows[0]?.n ?? 0);
      } catch {
        rowCount = null;
      }
      result.push({ name: tableName, columns, rowCount });
    }
    return result;
  };

  return {
    async testConnection() {
      await withClient(async (client) => {
        await client.query("SELECT 1");
      });
    },

    async listTables(): Promise<IntrospectedTable[]> {
      return withClient(introspectTables);
    },

    async sampleRows(tableName, limit) {
      return withClient(async (client) => {
        const rows = await client.query(
          `SELECT * FROM ${quoteIdent(tableName)} LIMIT ${Math.min(limit, 50)}`,
        );
        return rows.rows as Record<string, unknown>[];
      });
    },

    async queryRows(tableName, opts) {
      return withClient(async (client) => {
        const safeLimit = Math.min(opts.limit, 200);
        const rows = await client.query(
          `SELECT * FROM ${quoteIdent(tableName)} LIMIT ${safeLimit} OFFSET ${Math.max(opts.offset, 0)}`,
        );
        return rows.rows as Record<string, unknown>[];
      });
    },

    async close() {},
  };
}
