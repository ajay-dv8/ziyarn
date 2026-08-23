import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  dataSourceTables,
  dataSources,
  domains,
  documentChunks,
  embeddings,
  knowledgeDocuments,
} from "@repo/database/schema";
import { chunkText } from "@repo/api/knowledge/chunker";
import {
  MAX_DOCUMENT_CHARS,
  MAX_DOCUMENT_CHUNKS,
} from "@repo/api/knowledge/schemas";
import type { SessionWithUser } from "@repo/api/domains/server";

import { decryptJson, encryptJson } from "@repo/api/datasources/crypto";
import { createDriver } from "@repo/api/datasources/drivers";
import type { AnyConnection } from "@repo/api/datasources/drivers/types";
import {
  connectionSummary,
  isRelevantTable,
} from "@repo/api/datasources/relevance";
import { isEmailColumn, isNameColumn } from "@repo/api/customers/schemas";
import { upsertCustomers } from "@repo/api/customers/server";
import {
  SAMPLE_ROW_LIMIT,
  type ConnectDataSourceInput,
  type DeleteDataSourceInput,
  type ListDataSourcesInput,
  type SyncDataSourceInput,
  type UpdateDataSourceTablesInput,
} from "@repo/api/datasources/schemas";

/** Max rows scanned per table when importing contacts into the customer list. */
const CONTACT_IMPORT_LIMIT = 200;

export class DataSourceServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DataSourceServiceError";
  }
}

const unauthorized = () =>
  new DataSourceServiceError(401, "UNAUTHORIZED", "You must be signed in");
const forbidden = () =>
  new DataSourceServiceError(403, "FORBIDDEN", "You do not own this domain");
const domainNotFound = () =>
  new DataSourceServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");
const agentNotFound = () =>
  new DataSourceServiceError(404, "AGENT_NOT_FOUND", "Agent not found");
const sourceNotFound = () =>
  new DataSourceServiceError(404, "DATA_SOURCE_NOT_FOUND", "Data source not found");

const vectorLiteral = (values: number[]) =>
  sql`${`[${values.join(",")}]`}::vector`;

function toConnection(input: ConnectDataSourceInput): AnyConnection {
  switch (input.type) {
    case "postgres":
      return {
        type: "postgres",
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        password: input.password,
      };
    case "mysql":
      return {
        type: "mysql",
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        password: input.password,
      };
    case "mongodb":
      return { type: "mongodb", uri: input.uri, database: input.database };
    case "convex":
      return {
        type: "convex",
        url: input.url,
        deployKey: input.deployKey,
      };
  }
}

export function createDataSourcesService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
  embed: (texts: string[]) => Promise<number[][]>;
  embeddingModel: string;
}) {
  const { db, getSession, embed, embeddingModel } = deps;

  const requireOwnedAgent = async (
    domainId: string,
    agentId: string | null,
    headers: Headers,
  ): Promise<void> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [domain] = await db
      .select({ id: domains.id, ownerId: domains.ownerId })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);
    if (!domain) throw domainNotFound();
    if (domain.ownerId !== session.user.id) throw forbidden();

    if (agentId !== null) {
      const [agent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.id, agentId), eq(agents.domainId, domainId)))
        .limit(1);
      if (!agent) throw agentNotFound();
    }
  };

  const requireOwnedSource = async (
    domainId: string,
    dataSourceId: string,
    headers: Headers,
  ) => {
    await requireOwnedAgent(domainId, null, headers);
    const [source] = await db
      .select()
      .from(dataSources)
      .innerJoin(
        agents,
        and(eq(dataSources.agentId, agents.id), eq(agents.domainId, domainId)),
      )
      .where(eq(dataSources.id, dataSourceId))
      .limit(1);
    if (!source) throw sourceNotFound();
    const row = source.data_sources;
    void source.agents;
    return row;
  };

  /** Builds the knowledge text for one table: schema + sample rows. */
  function tableDocumentText(params: {
    label: string;
    tableName: string;
    columns: Array<{ name: string; type: string }> | null;
    rowCount: number | null;
    rows: Record<string, unknown>[];
  }): string {
    const columnLine = params.columns?.length
      ? params.columns.map((c) => `${c.name} (${c.type})`).join(", ")
      : "unknown — infer from sample rows below";
    const samples = params.rows.length
      ? params.rows
          .map((row) => JSON.stringify(row))
          .join("\n")
          .slice(0, MAX_DOCUMENT_CHARS / 2)
      : "(no rows)";
    return [
      `Database table "${params.tableName}" from connected database "${params.label}".`,
      `Columns: ${columnLine}`,
      `Row count: ${params.rowCount ?? "unknown"}.`,
      "",
      "Sample rows:",
      samples,
      "",
      `Use this table to answer customer questions about ${params.tableName.replace(/_/g, " ")}.`,
    ]
      .join("\n")
      .slice(0, MAX_DOCUMENT_CHARS);
  }

  /** Chunks + embeds + stores a synced table document. */
  async function ingestTableDocument(params: {
    agentId: string;
    dataSourceId: string;
    tableName: string;
    text: string;
  }): Promise<number> {
    let chunks = chunkText(params.text);
    if (chunks.length === 0) return 0;
    if (chunks.length > MAX_DOCUMENT_CHUNKS) {
      chunks = chunks.slice(0, MAX_DOCUMENT_CHUNKS);
    }

    const vectors = await embed(chunks);

    const [document] = await db
      .insert(knowledgeDocuments)
      .values({
        agentId: params.agentId,
        dataSourceId: params.dataSourceId,
        source: `[DB] ${params.tableName}`,
        title: params.tableName,
      })
      .returning({ id: knowledgeDocuments.id });
    if (!document) {
      throw new DataSourceServiceError(500, "INSERT_FAILED", "Failed to store table document");
    }

    const inserted = await db
      .insert(documentChunks)
      .values(
        chunks.map((text, index) => ({
          documentId: document.id,
          text,
          position: String(index),
        })),
      )
      .returning({ id: documentChunks.id });

    await db.insert(embeddings).values(
      inserted.map((chunk, index) => ({
        chunkId: chunk.id,
        model: embeddingModel,
        embedding: vectorLiteral(vectors[index] ?? []),
      })),
    );

    return inserted.length;
  }

  return {
    /** Tests the connection, introspects tables, and saves the data source. */
    connect: async (input: ConnectDataSourceInput, headers: Headers) => {
      await requireOwnedAgent(input.domainId, input.agentId, headers);

      if (input.type === "convex") {
        const hostname = new URL(input.url).hostname;
        if (hostname.endsWith(".convex.site")) {
          throw new DataSourceServiceError(
            400,
            "INVALID_CONVEX_URL",
            "That is your site URL — use the deployment URL ending in .convex.cloud instead",
          );
        }
      }

      const driver = await createDriver(toConnection(input));
      try {
        try {
          await driver.testConnection();
        } catch (error) {
          throw new DataSourceServiceError(
            400,
            "CONNECTION_FAILED",
            error instanceof Error
              ? `Could not connect: ${error.message}`
              : "Could not connect to the database",
          );
        }

        const tables = await driver.listTables();

        const summary = connectionSummary(input.type, {
          host: "host" in input ? input.host : undefined,
          port: "port" in input ? input.port : undefined,
          database: "database" in input ? input.database : undefined,
          uri: "uri" in input ? input.uri : undefined,
          url: "url" in input ? input.url : undefined,
        });

        const credentialsEncrypted = encryptJson(toConnection(input));
        const [source] = await db
          .insert(dataSources)
          .values({
            agentId: input.agentId,
            type: input.type,
            label: input.label,
            host: summary.host,
            databaseName: summary.databaseName,
            credentialsEncrypted,
            status: "connected",
          })
          .returning();
        if (!source) {
          throw new DataSourceServiceError(500, "INSERT_FAILED", "Failed to save data source");
        }

        const inserted = await db
          .insert(dataSourceTables)
          .values(
            tables.map((table) => ({
              dataSourceId: source.id,
              tableName: table.name,
              columnsJson: table.columns,
              rowCount: table.rowCount,
              relevant: isRelevantTable(table.name),
              included: isRelevantTable(table.name),
            })),
          )
          .returning();

        return { source, tables: inserted };
      } finally {
        await driver.close();
      }
    },

    /** Lists the data sources of an agent with their table selections. */
    list: async (input: ListDataSourcesInput, headers: Headers) => {
      await requireOwnedAgent(input.domainId, input.agentId, headers);

      const sources = await db
        .select()
        .from(dataSources)
        .where(eq(dataSources.agentId, input.agentId));

      const result = [];
      for (const source of sources) {
        const tables = await db
          .select({
            id: dataSourceTables.id,
            tableName: dataSourceTables.tableName,
            columnsJson: dataSourceTables.columnsJson,
            rowCount: dataSourceTables.rowCount,
            relevant: dataSourceTables.relevant,
            included: dataSourceTables.included,
          })
          .from(dataSourceTables)
          .where(eq(dataSourceTables.dataSourceId, source.id));

        result.push({ ...source, credentialsEncrypted: undefined, tables });
      }
      return result;
    },

    /** Persists user table selection before/without sync. */
    updateTables: async (
      input: UpdateDataSourceTablesInput,
      headers: Headers,
    ) => {
      const source = await requireOwnedSource(
        input.domainId,
        input.dataSourceId,
        headers,
      );

      for (const selection of input.selections) {
        await db
          .update(dataSourceTables)
          .set({ included: selection.included })
          .where(
            and(
              eq(dataSourceTables.dataSourceId, source.id),
              eq(dataSourceTables.tableName, selection.tableName),
            ),
          );
      }
      return { ok: true };
    },

    /**
     * Re-introspects the database, samples included tables, and replaces the
     * derived knowledge documents. Embeds schema + sample rows per table so
     * answer_knowledge can use live catalog data.
     */
    sync: async (input: SyncDataSourceInput, headers: Headers) => {
      const source = await requireOwnedSource(
        input.domainId,
        input.dataSourceId,
        headers,
      );
      const domainIdForContacts = input.domainId;

      const connection = decryptJson<AnyConnection>(
        source.credentialsEncrypted,
      );
      const driver = await createDriver(connection);

      try {
        const tables = await db
          .select()
          .from(dataSourceTables)
          .where(eq(dataSourceTables.dataSourceId, source.id));
        const included = tables.filter((table) => table.included);
        if (included.length === 0) {
          throw new DataSourceServiceError(
            400,
            "NO_TABLES_SELECTED",
            "Select at least one table to sync",
          );
        }

        let freshTables: Awaited<ReturnType<typeof driver.listTables>> = [];
        try {
          freshTables = await driver.listTables();
        } catch {
          // keep stale metadata rather than failing the whole sync
        }

        // Replace previous sync's documents so they never duplicate.
        await db
          .delete(knowledgeDocuments)
          .where(eq(knowledgeDocuments.dataSourceId, source.id));

        let documentsCreated = 0;
        const skipped: Array<{ tableName: string; error: string }> = [];
        for (const table of included) {
          const fresh = freshTables.find(
            (candidate) => candidate.name === table.tableName,
          );
          const columns =
            fresh?.columns ??
            (table.columnsJson as Array<{ name: string; type: string }> | null);
          const rowCount = fresh?.rowCount ?? table.rowCount;
          let rows: Record<string, unknown>[] = [];

          // One unreadable table must not abort the whole sync — record it
          // and continue so the rest of the catalog still becomes knowledge.
          try {
            rows = await driver.sampleRows(table.tableName, SAMPLE_ROW_LIMIT);
            const text = tableDocumentText({
              label: source.label,
              tableName: table.tableName,
              columns,
              rowCount,
              rows,
            });
            await ingestTableDocument({
              agentId: source.agentId,
              dataSourceId: source.id,
              tableName: table.tableName,
              text,
            });
            documentsCreated += 1;
          } catch (error) {
            skipped.push({
              tableName: table.tableName,
              error: error instanceof Error ? error.message : "read failed",
            });
          }

          // Contact import: tables with an email column feed the domain's
          // customer list (source "database"). Best-effort — never blocks sync.
          if (domainIdForContacts && columns?.some((c) => isEmailColumn(c.name))) {
            try {
              const emailCol = columns.find((c) => isEmailColumn(c.name))!.name;
              const nameCol = columns.find((c) => isNameColumn(c.name))?.name;
              const contactRows = await driver.sampleRows(
                table.tableName,
                CONTACT_IMPORT_LIMIT,
              );
              await upsertCustomers(db, {
                domainId: domainIdForContacts,
                source: "database",
                sourceLabel: `${table.tableName} (${source.label})`,
                rows: contactRows.map((row) => ({
                  email:
                    typeof row[emailCol] === "string"
                      ? (row[emailCol] as string)
                      : "",
                  name:
                    nameCol && typeof row[nameCol] === "string"
                      ? (row[nameCol] as string)
                      : null,
                })),
              });
            } catch {
              // Contact import is opportunistic; skip failures silently.
            }
          }
        }

        if (documentsCreated === 0 && skipped.length > 0) {
          throw new DataSourceServiceError(
            502,
            "SYNC_FAILED",
            `Could not read any selected table. First error: ${skipped[0]?.error}`,
          );
        }

        // Refresh stored metadata for all known tables.
        for (const table of tables) {
          const fresh = freshTables.find(
            (candidate) => candidate.name === table.tableName,
          );
          if (fresh) {
            await db
              .update(dataSourceTables)
              .set({
                columnsJson: fresh.columns,
                rowCount: fresh.rowCount,
              })
              .where(eq(dataSourceTables.id, table.id));
          }
        }

        await db
          .update(dataSources)
          .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
          .where(eq(dataSources.id, source.id));

        return { ok: true, documentsCreated, skipped };
      } finally {
        await driver.close();
      }
    },

    /** Removes a data source; its tables and derived documents cascade. */
    remove: async (input: DeleteDataSourceInput, headers: Headers) => {
      const source = await requireOwnedSource(
        input.domainId,
        input.dataSourceId,
        headers,
      );
      await db.delete(dataSources).where(eq(dataSources.id, source.id));
      return { ok: true };
    },
  };
}

export type DataSourcesService = ReturnType<typeof createDataSourcesService>;
