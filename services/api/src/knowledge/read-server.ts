import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  crawlJobs,
  documentChunks,
  embeddings,
  knowledgeDocuments,
} from "@repo/database/schema";

import type { SessionWithUser } from "@repo/api/domains/server";
import {
  findDomainAccess,
  roleCanEditDomainData,
} from "@repo/api/workspaces/access";
import type { KnowledgeFileStorage } from "@repo/api/knowledge/storage";
import {
  type CrawlStatusInput,
  crawlStatusSchema,
  type DeleteKnowledgeDocumentInput,
  deleteKnowledgeDocumentSchema,
  getFileSchema,
  type ListKnowledgeDocumentsInput,
  listKnowledgeDocumentsSchema,
  type QueryKnowledgeInput,
  queryKnowledgeSchema,
} from "@repo/api/knowledge/schemas";
import { KnowledgeServiceError } from "@repo/api/knowledge/errors";
import {
  isPrivatePageUrl,
  publicSourceUrl,
} from "@repo/api/knowledge/source-links";

const unauthorized = () =>
  new KnowledgeServiceError(401, "UNAUTHORIZED", "You must be signed in");
const forbidden = () =>
  new KnowledgeServiceError(
    403,
    "FORBIDDEN",
    "You are not a member of this domain's workspace",
  );
const forbiddenMutation = () =>
  new KnowledgeServiceError(
    403,
    "FORBIDDEN",
    "Viewers can only read this domain",
  );
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
 * Creates workspace access checks (requireDomainAccess, requireAgentAccess)
 * used by read, upload, and crawl services. Access follows membership in the
 * domain's workspace; the role gates writes. Extracted separately so
 * upload/crawl services can reuse them without pulling in the read service.
 */
export function createKnowledgeAccessChecks(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser | null>;
}) {
  const { db, getSession } = deps;

  const requireDomainAccess = async (
    domainId: string,
    headers: Headers,
    mutate = false,
  ): Promise<NonNullable<SessionWithUser>> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const access = await findDomainAccess(db, domainId, session.user.id);
    if (access.kind === "not_found") throw domainNotFound();
    if (access.kind === "forbidden") throw forbidden();
    if (mutate && !roleCanEditDomainData(access.role)) {
      throw forbiddenMutation();
    }

    return session;
  };

  const requireAgentAccess = async (
    domainId: string,
    agentId: string,
    headers: Headers,
    mutate = false,
  ): Promise<void> => {
    await requireDomainAccess(domainId, headers, mutate);

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.domainId, domainId)))
      .limit(1);

    if (!agent) throw agentNotFound();
  };

  return { requireDomainAccess, requireAgentAccess };
}

/**
 * Read-only knowledge service: query, list, get, delete, crawl status.
 *
 * Intentionally does NOT import `extract.ts` or `crawler.ts`, so routes that
 * only need read access (chat, document listing, file download, delete) do not
 * trace the PDF/XLSX/DOCX extraction stack or the native `@napi-rs/canvas`
 * binary (~30 MB).
 */
export function createReadKnowledgeService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser | null>;
  resolveEmbedder: (agentId: string) => Promise<{
    embed: (texts: string[]) => Promise<number[][]>;
    model: string;
  }>;
  storage: KnowledgeFileStorage;
}) {
  const { db, getSession, resolveEmbedder, storage } = deps;
  const { requireDomainAccess, requireAgentAccess } = createKnowledgeAccessChecks({
    db,
    getSession,
  });

  /** Returns the stored file of a document the session user can access. */
  const getFile = async (
    input: { domainId: string; documentId: string },
    headers: Headers,
  ) => {
    const parsed = getFileSchema.parse(input);
    await requireDomainAccess(parsed.domainId, headers);

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
  };

  /** Lists documents of an agent the session user can access. */
  const listDocuments = async (
    input: ListKnowledgeDocumentsInput,
    headers: Headers,
  ) => {
    const body = listKnowledgeDocumentsSchema.parse(input);
    await requireAgentAccess(body.domainId, body.agentId, headers);

    return db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.agentId, body.agentId))
      .orderBy(knowledgeDocuments.createdAt);
  };

  /** Deletes a document (cascades to chunks and embeddings). */
  const deleteDocument = async (
    input: DeleteKnowledgeDocumentInput,
    headers: Headers,
  ) => {
    const body = deleteKnowledgeDocumentSchema.parse(input);
    await requireDomainAccess(body.domainId, headers, true);

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
  };

  /** Returns the latest crawl job of an agent plus its document count. */
  const getCrawlStatus = async (input: CrawlStatusInput, headers: Headers) => {
    const body = crawlStatusSchema.parse(input);
    await requireAgentAccess(body.domainId, body.agentId, headers);

    const [job] = await db
      .select()
      .from(crawlJobs)
      .where(eq(crawlJobs.agentId, body.agentId))
      .orderBy(desc(crawlJobs.createdAt))
      .limit(1);

    if (!job) return { job: null, documentCount: 0 };

    const [counts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.crawlJobId, job.id));

    return { job, documentCount: counts?.count ?? 0 };
  };

  /**
   * Searches the knowledge base of an agent (used by the public chat API;
   * no session required — the caller already scoped the agent). Returns the
   * most similar chunks above minScore with their public source title/URL.
   */
  const queryKnowledge = async (input: QueryKnowledgeInput) => {
    const body = queryKnowledgeSchema.parse(input);

    const [existing] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.agentId, body.agentId))
      .limit(1);
    if ((existing?.count ?? 0) === 0) return [];

    let queryVector: number[];
    try {
      const embedder = await resolveEmbedder(body.agentId);
      const vectors = await embedder.embed([body.query]);
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
        title: knowledgeDocuments.title,
        source: knowledgeDocuments.source,
        fileName: knowledgeDocuments.fileName,
        crawlJobId: knowledgeDocuments.crawlJobId,
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
      .filter(
        (row) => !(row.fileName && isPrivatePageUrl(row.fileName)),
      )
      .map((row) => ({
        text: row.text,
        score: row.score,
        title: row.title?.trim() || row.source?.trim() || null,
        url: row.crawlJobId ? publicSourceUrl(row.fileName) : null,
      }));
  };

  return {
    getFile,
    listDocuments,
    deleteDocument,
    getCrawlStatus,
    queryKnowledge,
  };
}

export type ReadKnowledgeService = ReturnType<
  typeof createReadKnowledgeService
>;
