import { and, eq, ne } from "drizzle-orm";

import type { Database } from "@repo/database";
import { crawlJobs, knowledgeDocuments } from "@repo/database/schema";

import { createDefaultFetchPage, crawlWebsite } from "@repo/api/knowledge/crawler";
import { startCrawlSchema } from "@repo/api/knowledge/schemas";
import { KnowledgeServiceError } from "@repo/api/knowledge/errors";
import { createOwnershipChecks } from "@repo/api/knowledge/read-server";
import { ingestContent } from "@repo/api/knowledge/ingest";

/**
 * Crawl operations. Imports `crawler.ts` (which itself imports `extract.ts`
 * for HTML text extraction). Only crawl routes should import this — read
 * routes must not.
 */
export function createCrawlKnowledgeService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<{
    user: { id: string };
    email?: string;
  } | null>;
  resolveEmbedder: (agentId: string) => Promise<{
    embed: (texts: string[]) => Promise<number[][]>;
    model: string;
  }>;
}) {
  const { db, getSession, resolveEmbedder } = deps;
  const { requireOwnedAgent } = createOwnershipChecks({ db, getSession });

  /** Creates a crawl job and returns it together with a `run` function. */
  const startCrawl = async (
    input: {
      domainId: string;
      agentId: string;
      url: string;
    },
    headers: Headers,
  ): Promise<{
    job: { id: string; agentId: string; url: string; status: string };
    run: () => Promise<void>;
  }> => {
    const body = startCrawlSchema.parse(input);
    await requireOwnedAgent(body.domainId, body.agentId, headers);
    const embedder = await resolveEmbedder(body.agentId);

    const [job] = await db
      .insert(crawlJobs)
      .values({
        agentId: body.agentId,
        url: body.url,
        status: "running",
      })
      .returning({
        id: crawlJobs.id,
        agentId: crawlJobs.agentId,
        url: crawlJobs.url,
        status: crawlJobs.status,
      });
    if (!job) {
      throw new KnowledgeServiceError(
        500,
        "INSERT_FAILED",
        "Failed to create crawl job",
      );
    }

    // Remove documents from earlier crawls of this agent so a re-crawl
    // replaces stale site knowledge instead of duplicating it.
    await db
      .delete(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.agentId, body.agentId),
          ne(knowledgeDocuments.crawlJobId, job.id),
        ),
      );
    await db.delete(crawlJobs).where(
      and(eq(crawlJobs.agentId, body.agentId), ne(crawlJobs.id, job.id)),
    );

    const fetchPage = createDefaultFetchPage();

    const run = async () => {
      const fail = async (message: string) => {
        await db
          .update(crawlJobs)
          .set({
            status: "failed",
            error: message.slice(0, 1000),
            updatedAt: new Date(),
          })
          .where(eq(crawlJobs.id, job.id));
      };
      try {
        const result = await crawlWebsite(
          {
            fetchPage,
            onPage: async (page) => {
              await ingestContent(
                { db, embedder },
                body.agentId,
                page.text,
                page.title ?? page.url,
                {
                  fileName: page.url,
                  fileMime: "text/html",
                  fileSize: page.text.length,
                },
                job.id,
              );
            },
          },
          { startUrl: body.url },
        );
        await db
          .update(crawlJobs)
          .set({
            status: result.pagesCrawled > 0 ? "completed" : "failed",
            pagesFound: result.pagesFound,
            pagesCrawled: result.pagesCrawled,
            error:
              result.errors.length > 0
                ? result.errors.slice(0, 5).join(" | ").slice(0, 1000)
                : null,
            updatedAt: new Date(),
          })
          .where(eq(crawlJobs.id, job.id));
      } catch (error) {
        await fail(
          error instanceof Error ? error.message : "Crawl failed unexpectedly",
        );
      }
    };

    return { job, run };
  };

  return {
    startCrawl,
  };
}

export type CrawlKnowledgeService = ReturnType<
  typeof createCrawlKnowledgeService
>;
