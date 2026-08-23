import type {
  DbDriver,
  IntrospectedColumn,
  IntrospectedTable,
  MongodbConnection,
} from "@repo/api/datasources/drivers/types";

export async function createMongodbDriver(
  connection: MongodbConnection,
): Promise<DbDriver> {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(connection.uri, {
    serverSelectionTimeoutMS: 10_000,
  });

  const databaseName =
    connection.database ??
    (() => {
      try {
        return new URL(replaceSrv(connection.uri)).pathname.replace("/", "");
      } catch {
        return "";
      }
    })();

  if (!databaseName) {
    throw new Error(
      "MongoDB connection requires a database name (add it to the URI or the field)",
    );
  }

  return {
    async testConnection() {
      await client.connect();
      await client.db(databaseName).command({ ping: 1 });
    },

    async listTables(): Promise<IntrospectedTable[]> {
      await client.connect();
      const db = client.db(databaseName);
      const collections = await db.listCollections().toArray();
      const result: IntrospectedTable[] = [];
      for (const collection of collections) {
        const name = collection.name;
        if (name.startsWith("system.")) continue;
        let rowCount: number | null = null;
        try {
          rowCount = await db.collection(name).countDocuments();
        } catch {
          rowCount = null;
        }
        let columns: IntrospectedColumn[] = [];
        try {
          const docs = await db
            .collection(name)
            .find()
            .limit(20)
            .toArray();
          columns = inferColumns(docs);
        } catch {
          columns = [];
        }
        result.push({ name, columns, rowCount });
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    },

    async sampleRows(tableName, limit) {
      const db = client.db(databaseName);
      const docs = await db
        .collection(tableName)
        .find()
        .limit(Math.min(limit, 50))
        .toArray();
      return docs.map((doc) =>
        JSON.parse(JSON.stringify(doc)),
      ) as Record<string, unknown>[];
    },

    async close() {
      await client.close().catch(() => undefined);
    },
  };
}

function replaceSrv(uri: string): string {
  return uri.replace("mongodb+srv://", "https://");
}

/** Infers column names/types as the union of top-level fields in sampled docs. */
function inferColumns(docs: Record<string, unknown>[]): IntrospectedColumn[] {
  const seen = new Map<string, string>();
  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      if (!seen.has(key)) {
        seen.set(key, jsonTypeOf(value));
      }
    }
  }
  return Array.from(seen, ([name, type]) => ({ name, type }));
}

function jsonTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "object":
      return "object";
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}
