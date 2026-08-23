import type {
  ConvexConnection,
  DbDriver,
  IntrospectedColumn,
  IntrospectedTable,
} from "@repo/api/datasources/drivers/types";

type PaginationResult<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
};

const QUERY_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [500, 1500, 3000];

/** Extracts a human-readable message from Node fetch's wrapped errors. */
function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: unknown }).cause as
    | { code?: string; message?: string; hostname?: string }
    | undefined;
  if (cause?.code === "ENOTFOUND") {
    return `hostname not found (${cause.hostname ?? "unknown host"})`;
  }
  if (cause?.code === "ETIMEDOUT" || cause?.code === "ECONNREFUSED") {
    return `could not reach the deployment (${cause.code})`;
  }
  if (/aborted due to timeout/i.test(error.message)) {
    return "request timed out";
  }
  return error.message;
}

const isRetryableNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    /fetch failed|timed out|network|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket/i.test(
      `${error.message} ${
        ((error as { cause?: { code?: string } }).cause?.code ?? "")
      }`,
    ) || /aborted due to timeout/i.test(error.message)
  );
};

export async function createConvexDriver(
  connection: ConvexConnection,
): Promise<DbDriver> {
  const base = connection.url.replace(/\/+$/, "");

  async function runSystemQuery<TResult>(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<TResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await fetch(`${base}/api/query`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Convex ${connection.deployKey}`,
          },
          body: JSON.stringify({
            path: functionName,
            args,
            format: "json",
          }),
          signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new Error(
            `Convex API error ${response.status}: ${(await response.text()).slice(0, 300)}`,
          );
        }
        const body = (await response.json()) as {
          status: string;
          value?: TResult;
          errorMessage?: string;
        };
        if (body.status !== "success") {
          throw new Error(
            `Convex query failed: ${body.errorMessage ?? body.status}. Check the deploy key.`,
          );
        }
        return body.value as TResult;
      } catch (error) {
        lastError = error;
        // Only transient network problems are worth retrying — auth and
        // API errors fail fast so users see them immediately.
        if (!isRetryableNetworkError(error)) break;
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
          );
        }
      }
    }

    throw new Error(describeFetchError(lastError));
  }

  async function listAllTables(): Promise<string[]> {
    const names: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 20; page += 1) {
      const result: PaginationResult<string | { name?: string }> =
        await runSystemQuery("_system/cli/tables", {
          paginationOpts: { numItems: 500, cursor },
        });
      // The system function returns table descriptors ({ name }) rather than
      // plain strings — normalize both possible shapes here.
      names.push(
        ...result.page
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : typeof entry?.name === "string"
                ? entry.name
                : "",
          )
          .filter(Boolean),
      );
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return names.filter((name) => !name.startsWith("_"));
  }

  async function sampleDocuments(
    tableName: string,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    const result = await runSystemQuery<
      | PaginationResult<Record<string, unknown>>
      | Record<string, unknown>[]
    >("_system/cli/tableData", {
      table: tableName,
      order: "desc",
      paginationOpts: { numItems: limit, cursor: null },
    });
    // Tolerate both paginated results and bare document arrays.
    const page = Array.isArray(result)
      ? result
      : ((result as PaginationResult<Record<string, unknown>>).page ?? []);
    return page as Record<string, unknown>[];
  }

  function inferColumns(docs: Record<string, unknown>[]): IntrospectedColumn[] {
    const seen = new Map<string, string>();
    for (const doc of docs) {
      for (const [key, value] of Object.entries(doc)) {
        if (!seen.has(key)) seen.set(key, jsonTypeOf(value));
      }
    }
    return Array.from(seen, ([name, type]) => ({ name, type }));
  }

  return {
    async testConnection() {
      try {
        await listAllTables();
      } catch (error) {
        throw new Error(
          error instanceof Error ? error.message : "Connection test failed",
        );
      }
    },

    async listTables(): Promise<IntrospectedTable[]> {
      const tableNames = await listAllTables();
      const result: IntrospectedTable[] = [];
      for (const name of tableNames) {
        let rowCount: number | null = null;
        let columns: IntrospectedColumn[] = [];
        try {
          const docs = await sampleDocuments(name, 20);
          columns = inferColumns(docs);
          const size = await runSystemQuery<number>(
            "_system/cli/tableSize:default",
            { tableName: name },
          );
          rowCount = typeof size === "number" ? size : null;
        } catch {
          columns = [];
        }
        result.push({ name, columns, rowCount });
      }
      return result;
    },

    async sampleRows(tableName, limit) {
      const docs = await sampleDocuments(tableName, limit);
      return docs.map((doc) => {
        const copy = { ...doc };
        delete copy._creationTime;
        return copy;
      });
    },

    async close() {},
  };
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
