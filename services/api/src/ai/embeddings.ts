import { eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  documentChunks,
  embeddings,
  knowledgeDocuments,
} from "@repo/database/schema";
import { EMBEDDING_DIMENSIONS } from "@repo/api/ai/schemas";

const EMBED_BATCH_SIZE = 64;
const UPDATE_BATCH_SIZE = 100;

/**
 * Re-indexing runs inline with the settings save. Beyond this the request is
 * too large to finish inside a serverless timeout; the owner must split the
 * knowledge base or wait for a background job (not implemented yet).
 */
export const MAX_REINDEX_CHUNKS = 5000;

export class EmbeddingReindexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingReindexError";
  }
}

const toVectorLiteral = (values: number[]) => `[${values.join(",")}]`;

/**
 * Re-embeds every chunk of the given domains with the new model.
 *
 * All external embedding calls finish before the first write, and each write
 * batch is a single UPDATE, so a provider failure leaves the old vectors
 * untouched. Shortcut: the batches are not wrapped in one transaction (the
 * neon-http driver has none); a mid-write database failure is fixed by saving
 * again, which recomputes every vector.
 */
export async function reindexDomainEmbeddings(params: {
  db: Database;
  domainIds: string[];
  embed: (texts: string[]) => Promise<number[][]>;
  model: string;
}): Promise<{ chunks: number }> {
  if (params.domainIds.length === 0) return { chunks: 0 };

  const rows = await params.db
    .select({ id: embeddings.id, text: documentChunks.text })
    .from(embeddings)
    .innerJoin(documentChunks, eq(embeddings.chunkId, documentChunks.id))
    .innerJoin(
      knowledgeDocuments,
      eq(documentChunks.documentId, knowledgeDocuments.id),
    )
    .innerJoin(agents, eq(knowledgeDocuments.agentId, agents.id))
    .where(inArray(agents.domainId, params.domainIds));

  if (rows.length === 0) return { chunks: 0 };
  if (rows.length > MAX_REINDEX_CHUNKS) {
    throw new EmbeddingReindexError(
      `This knowledge base has ${rows.length} chunks; automatic re-indexing is limited to ${MAX_REINDEX_CHUNKS}.`,
    );
  }

  const vectors: number[][] = [];
  for (let start = 0; start < rows.length; start += EMBED_BATCH_SIZE) {
    const batch = rows.slice(start, start + EMBED_BATCH_SIZE);
    const batchVectors = await params.embed(batch.map((row) => row.text));
    if (batchVectors.length !== batch.length) {
      throw new EmbeddingReindexError(
        "The embedding provider returned the wrong number of vectors.",
      );
    }
    for (const vector of batchVectors) {
      if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingReindexError(
          `The embedding model returned ${vector.length} dimensions; Ziyarn stores ${EMBEDDING_DIMENSIONS}.`,
        );
      }
    }
    vectors.push(...batchVectors);
  }

  for (let start = 0; start < rows.length; start += UPDATE_BATCH_SIZE) {
    const batch = rows.slice(start, start + UPDATE_BATCH_SIZE);
    const values = sql.join(
      batch.map((row, index) => {
        const vector = vectors[start + index] ?? [];
        return sql`(${row.id}::uuid, ${toVectorLiteral(vector)}::vector)`;
      }),
      sql`, `,
    );
    await params.db.execute(sql`
      UPDATE ${embeddings} AS e
      SET model = ${params.model}, embedding = v.embedding
      FROM (VALUES ${values}) AS v(id, embedding)
      WHERE e.id = v.id
    `);
  }

  return { chunks: rows.length };
}
