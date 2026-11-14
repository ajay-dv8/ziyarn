import { sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  documentChunks,
  embeddings,
  knowledgeDocuments,
} from "@repo/database/schema";

import { EMBEDDING_DIMENSIONS } from "@repo/api/ai/schemas";
import { chunkText } from "@repo/api/knowledge/chunker";
import { MAX_DOCUMENT_CHUNKS } from "@repo/api/knowledge/schemas";
import { KnowledgeServiceError } from "@repo/api/knowledge/errors";

const vectorLiteral = (values: number[]) =>
  sql`${`[${values.join(",")}]`}::vector`;

/**
 * Chunks, embeds, and persists a document. Shared by text paste + file upload
 * and by the crawl runner. Does NOT import extract.ts or crawler.ts.
 */
export async function ingestContent(
  deps: {
    db: Database;
    embedder: { embed: (texts: string[]) => Promise<number[][]>; model: string };
  },
  agentId: string,
  content: string,
  title: string | undefined,
  file?: {
    fileName: string;
    fileMime?: string;
    fileSize?: number;
    storageKey?: string;
  },
  crawlJobId?: string,
) {
  const { db, embedder } = deps;

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    throw new KnowledgeServiceError(
      400,
      "EMPTY_CONTENT",
      "Content produced no text chunks",
    );
  }
  if (chunks.length > MAX_DOCUMENT_CHUNKS) {
    throw new KnowledgeServiceError(
      413,
      "CONTENT_TOO_LARGE",
      `Content produces ${chunks.length} chunks (max ${MAX_DOCUMENT_CHUNKS})`,
    );
  }

  let vectors: number[][];
  try {
    vectors = await embedder.embed(chunks);
  } catch (error) {
    if (error instanceof Error && /not configured|API key/.test(error.message)) {
      throw new KnowledgeServiceError(
        503,
        "AI_NOT_CONFIGURED",
        "AI is not configured for this deployment",
      );
    }
    throw new KnowledgeServiceError(
      502,
      "EMBEDDING_FAILED",
      error instanceof Error ? error.message : "Embedding failed",
    );
  }
  // BYO models can ignore the requested dimensions; reject before any row is
  // written so the document never ends up without usable vectors.
  if (
    vectors.length !== chunks.length ||
    vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new KnowledgeServiceError(
      502,
      "EMBEDDING_FAILED",
      `The embedding model must return one ${EMBEDDING_DIMENSIONS}-dimension vector per chunk`,
    );
  }

  const [document] = await db
    .insert(knowledgeDocuments)
    .values({
      agentId,
      crawlJobId: crawlJobId ?? null,
      source: title ?? (file?.fileName ?? "untitled"),
      title,
      ...file,
    })
    .returning({ id: knowledgeDocuments.id });
  if (!document) {
    throw new KnowledgeServiceError(
      500,
      "INSERT_FAILED",
      "Failed to create knowledge document",
    );
  }

  const insertedChunks = await db
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
    insertedChunks.map((chunk, index) => ({
      chunkId: chunk.id,
      model: embedder.model,
      embedding: vectorLiteral(vectors[index] ?? []),
    })),
  );

  return { document, chunkCount: insertedChunks.length };
}
