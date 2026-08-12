import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  documentChunks,
  domains,
  embeddings,
  knowledgeDocuments,
} from "@repo/database/schema";

import type { SessionWithUser } from "@repo/api/domains/server";
import {
  detectFileType,
  extensionOf,
  extractFileText,
} from "@repo/api/knowledge/extract";
import type { KnowledgeFileStorage } from "@repo/api/knowledge/storage";
import { chunkText } from "@repo/api/knowledge/chunker";
import {
  MAX_DOCUMENT_CHUNKS,
  type CreateKnowledgeDocumentInput,
  createKnowledgeDocumentSchema,
  type DeleteKnowledgeDocumentInput,
  deleteKnowledgeDocumentSchema,
  getFileSchema,
  type ListKnowledgeDocumentsInput,
  listKnowledgeDocumentsSchema,
  type QueryKnowledgeInput,
  queryKnowledgeSchema,
  uploadFileSchema,
} from "@repo/api/knowledge/schemas";

export class KnowledgeServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeServiceError";
  }
}

const unauthorized = () =>
  new KnowledgeServiceError(401, "UNAUTHORIZED", "You must be signed in");
const forbidden = () =>
  new KnowledgeServiceError(403, "FORBIDDEN", "You do not own this domain");
const domainNotFound = () =>
  new KnowledgeServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");
const agentNotFound = () =>
  new KnowledgeServiceError(404, "AGENT_NOT_FOUND", "Agent not found");
const documentNotFound = () =>
  new KnowledgeServiceError(404, "DOCUMENT_NOT_FOUND", "Document not found");
const aiNotConfigured = () =>
  new KnowledgeServiceError(
    503,
    "AI_NOT_CONFIGURED",
    "AI is not configured for this deployment",
  );

const vectorLiteral = (values: number[]) =>
  sql`${`[${values.join(",")}]`}::vector`;

/**
 * Knowledge base: upload documents, embed their chunks, and search them with
 * cosine similarity (pgvector). Mutations are owner-scoped like the other
 * services; querying is agent-scoped (used by the public chat API).
 */
export function createKnowledgeService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
  embed: (texts: string[]) => Promise<number[][]>;
  embeddingModel: string;
  storage: KnowledgeFileStorage;
}) {
  const { db, getSession, embed, embeddingModel, storage } = deps;

  const requireOwnedDomain = async (
    domainId: string,
    headers: Headers,
  ): Promise<NonNullable<SessionWithUser>> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [domain] = await db
      .select({ id: domains.id, ownerId: domains.ownerId })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);

    if (!domain) throw domainNotFound();
    if (domain.ownerId !== session.user.id) throw forbidden();

    return session;
  };

  const requireOwnedAgent = async (
    domainId: string,
    agentId: string,
    headers: Headers,
  ): Promise<void> => {
    await requireOwnedDomain(domainId, headers);

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.domainId, domainId)))
      .limit(1);

    if (!agent) throw agentNotFound();
  };

  /** Chunks, embeds, and persists a document. Shared by text paste + file upload. */
  const ingestContent = async (
    agentId: string,
    content: string,
    title: string | undefined,
    file?: {
      fileName: string;
      fileMime: string;
      fileSize: number;
      storageKey: string;
    },
  ) => {
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
      vectors = await embed(chunks);
    } catch (error) {
      if (error instanceof Error && /not configured|API key/.test(error.message)) {
        throw aiNotConfigured();
      }
      throw new KnowledgeServiceError(
        502,
        "EMBEDDING_FAILED",
        error instanceof Error ? error.message : "Embedding failed",
      );
    }

    const [document] = await db
      .insert(knowledgeDocuments)
      .values({
        agentId,
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
        model: embeddingModel,
        embedding: vectorLiteral(vectors[index] ?? []),
      })),
    );

    return { document, chunkCount: insertedChunks.length };
  };

  return {
    /**
     * Uploads a document: chunks it, embeds the chunks, and stores the
     * document with its chunks and embeddings atomically.
     */
    uploadDocument: async (
      input: CreateKnowledgeDocumentInput,
      headers: Headers,
    ) => {
      const body = createKnowledgeDocumentSchema.parse(input);
      await requireOwnedAgent(body.domainId, body.agentId, headers);

      return ingestContent(body.agentId, body.content, body.title);
    },

    /**
     * Uploads a file as a knowledge document: stores the original in
     * app-owned storage, extracts text, and runs the same chunk/embed
     * pipeline as paste uploads.
     */
    uploadFile: async (
      input: {
        domainId: string;
        agentId: string;
        fileName: string;
        fileMime: string;
        data: Uint8Array;
      },
      headers: Headers,
    ) => {
      const parsed = uploadFileSchema.parse(input);
      await requireOwnedAgent(parsed.domainId, parsed.agentId, headers);

      const type = detectFileType(parsed.fileName);
      if (!type) {
        throw new KnowledgeServiceError(
          415,
          "UNSUPPORTED_FILE_TYPE",
          "Supported files: PDF, TXT, MD, HTML",
        );
      }

      let content: string;
      try {
        content = await extractFileText(type, parsed.fileName, parsed.data);
      } catch (error) {
        throw new KnowledgeServiceError(
          422,
          "EXTRACTION_FAILED",
          error instanceof Error ? error.message : "Could not read this file",
        );
      }

      const storageKey = `${parsed.agentId}/${randomUUID()}.${extensionOf(parsed.fileName)}`;
      await storage.save(storageKey, parsed.data);

      try {
        return await ingestContent(parsed.agentId, content, parsed.fileName, {
          fileName: parsed.fileName,
          fileMime: parsed.fileMime,
          fileSize: parsed.data.byteLength,
          storageKey,
        });
      } catch (error) {
        await storage.remove(storageKey);
        throw error;
      }
    },

    /** Returns the stored file of a document the session user owns. */
    getFile: async (
      input: { domainId: string; documentId: string },
      headers: Headers,
    ) => {
      const parsed = getFileSchema.parse(input);
      await requireOwnedDomain(parsed.domainId, headers);

      const [document] = await db
        .select({
          id: knowledgeDocuments.id,
          storageKey: knowledgeDocuments.storageKey,
          fileName: knowledgeDocuments.fileName,
          fileMime: knowledgeDocuments.fileMime,
        })
        .from(knowledgeDocuments)
        .innerJoin(agents, eq(knowledgeDocuments.agentId, agents.id))
        .where(
          and(
            eq(knowledgeDocuments.id, parsed.documentId),
            eq(agents.domainId, parsed.domainId),
          ),
        )
        .limit(1);

      if (!document || !document.storageKey) throw documentNotFound();
      const data = await storage.load(document.storageKey);
      if (!data) throw documentNotFound();
      return {
        data,
        fileName: document.fileName ?? "document",
        fileMime: document.fileMime ?? "application/octet-stream",
      };
    },

    /** Lists documents of an agent the session user owns. */
    listDocuments: async (
      input: ListKnowledgeDocumentsInput,
      headers: Headers,
    ) => {
      const body = listKnowledgeDocumentsSchema.parse(input);
      await requireOwnedAgent(body.domainId, body.agentId, headers);

      return db
        .select()
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.agentId, body.agentId))
        .orderBy(knowledgeDocuments.createdAt);
    },

    /** Deletes a document (cascades to chunks and embeddings). */
    deleteDocument: async (
      input: DeleteKnowledgeDocumentInput,
      headers: Headers,
    ) => {
      const body = deleteKnowledgeDocumentSchema.parse(input);
      await requireOwnedDomain(body.domainId, headers);

      const [document] = await db
        .select({ id: knowledgeDocuments.id, storageKey: knowledgeDocuments.storageKey })
        .from(knowledgeDocuments)
        .innerJoin(agents, eq(knowledgeDocuments.agentId, agents.id))
        .where(
          and(
            eq(knowledgeDocuments.id, body.documentId),
            eq(agents.domainId, body.domainId),
          ),
        )
        .limit(1);

      if (!document) throw documentNotFound();
      if (document.storageKey) {
        await storage.remove(document.storageKey);
      }
      await db
        .delete(knowledgeDocuments)
        .where(eq(knowledgeDocuments.id, document.id));
    },

    /**
     * Searches the knowledge base of an agent (used by the public chat API;
     * no session required — the caller already scoped the agent). Returns the
     * most similar chunks above minScore, or an empty list when the agent has
     * no knowledge base at all.
     */
    queryKnowledge: async (input: QueryKnowledgeInput) => {
      const body = queryKnowledgeSchema.parse(input);

      const [existing] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.agentId, body.agentId))
        .limit(1);
      if ((existing?.count ?? 0) === 0) return [];

      let queryVector: number[];
      try {
        const vectors = await embed([body.query]);
        const first = vectors[0];
        if (!first) {
          throw new KnowledgeServiceError(
            502,
            "EMBEDDING_FAILED",
            "Embedding returned no vector",
          );
        }
        queryVector = first;
      } catch (error) {
        if (error instanceof Error && /not configured|API key/.test(error.message)) {
          throw aiNotConfigured();
        }
        throw new KnowledgeServiceError(
          502,
          "EMBEDDING_FAILED",
          error instanceof Error ? error.message : "Embedding failed",
        );
      }

      const vector = vectorLiteral(queryVector);
      const minScore = body.minScore ?? 0.5;
      const results = await db
        .select({
          text: documentChunks.text,
          score: sql<number>`1 - (${embeddings.embedding} <=> ${vector})`,
        })
        .from(embeddings)
        .innerJoin(documentChunks, eq(embeddings.chunkId, documentChunks.id))
        .innerJoin(
          knowledgeDocuments,
          eq(documentChunks.documentId, knowledgeDocuments.id),
        )
        .where(eq(knowledgeDocuments.agentId, body.agentId))
        .orderBy(sql`${embeddings.embedding} <=> ${vector}`)
        .limit(body.limit);

      return results
        .filter((row) => row.score >= minScore)
        .map((row) => ({ text: row.text, score: row.score }));
    },
  };
}

export type KnowledgeService = ReturnType<typeof createKnowledgeService>;
