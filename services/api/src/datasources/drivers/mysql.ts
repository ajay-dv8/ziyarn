import type { RowDataPacket } from "mysql2/promise";

import type {
  DbDriver,
  IntrospectedTable,
  MysqlConnection,
} from "@repo/api/datasources/drivers/types";

export async function createMysqlDriver(
  connection: MysqlConnection,
): Promise<DbDriver> {
  const mysql = await import("mysql2/promise");
  const conn = await mysql.createConnection({
    host: connection.host,
    port: connection.port,
    database: connection.database,
    user: connection.username,
    password: connection.password,
    connectTimeout: 10_000,
    ssl: { rejectUnauthorized: false },
  });

  const quoteIdent = (identifier: string) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error(`Invalid table name: ${identifier}`);
    }
    return "`" + identifier + "`";
  };

  return {
    async testConnection() {
      await conn.ping();
    },

    async listTables(): Promise<IntrospectedTable[]> {
      const [tables] = await conn.query<RowDataPacket[]>(
        `SELECT table_name AS table_name FROM information_schema.tables
         WHERE table_schema = ? AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [connection.database],
      );
      const result: IntrospectedTable[] = [];
      for (const row of tables) {
        const tableName = String(row.table_name);
        const [columns] = await conn.query<RowDataPacket[]>(
          `SELECT column_name, data_type FROM information_schema.columns
           WHERE table_schema = ? AND table_name = ?
           ORDER BY ordinal_position`,
          [connection.database, tableName],
        );
        let rowCount: number | null = null;
        try {
          const [counted] = await conn.query<RowDataPacket[]>(
            `SELECT count(*) AS n FROM ${quoteIdent(tableName)}`,
          );
          rowCount = Number((counted[0] as { n: number } | undefined)?.n ?? 0);
        } catch {
          rowCount = null;
        }
        result.push({
          name: tableName,
          columns: columns.map((col) => ({
            name: String(col.column_name),
            type: String(col.data_type),
          })),
          rowCount,
        });
      }
      return result;
    },

    async sampleRows(tableName, limit) {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM ${quoteIdent(tableName)} LIMIT ${Math.min(limit, 50)}`,
      );
      return rows as Record<string, unknown>[];
    },

    async queryRows(tableName, opts) {
      const safeLimit = Math.min(opts.limit, 200);
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT * FROM ${quoteIdent(tableName)} LIMIT ${safeLimit} OFFSET ${Math.max(opts.offset, 0)}`,
      );
      return rows as Record<string, unknown>[];
    },

    async close() {
      await conn.end().catch(() => undefined);
    },
  };
}
