import type { Database } from "@repo/database";

import {
  createReadKnowledgeService,
  type ReadKnowledgeService,
} from "@repo/api/knowledge/read-server";
import {
  createUploadKnowledgeService,
  type UploadKnowledgeService,
} from "@repo/api/knowledge/upload-server";
import {
  createCrawlKnowledgeService,
  type CrawlKnowledgeService,
} from "@repo/api/knowledge/crawl-server";
import { KnowledgeServiceError } from "@repo/api/knowledge/errors";

/**
 * Full knowledge service: composes read, upload, and crawl operations.
 *
 * Importing this module (or the `@repo/api/knowledge` barrel) pulls in
 * `extract.ts` and `crawler.ts`, which trace the PDF/XLSX/DOCX extraction
 * stack (~30 MB including `@napi-rs/canvas`). Read-only routes should
 * import from `@repo/api/knowledge/read-server` instead.
 */
export type KnowledgeEmbedder = {
  embed: (texts: string[]) => Promise<number[][]>;
  model: string;
};

export function createKnowledgeService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<{
    user: { id: string };
    email?: string;
  } | null>;
  resolveEmbedder: (agentId: string) => Promise<{
    embed: (texts: string[]) => Promise<number[][]>;
    model: string;
  }>;
  storage: Parameters<
    typeof createReadKnowledgeService
  >[0]["storage"];
}) {
  const read = createReadKnowledgeService(deps);
  const upload = createUploadKnowledgeService(deps);
  const crawl = createCrawlKnowledgeService(deps);

  return {
    ...read,
    ...upload,
    ...crawl,
  };
}

export type KnowledgeService = ReturnType<typeof createKnowledgeService>;

export { KnowledgeServiceError };
export type {
  ReadKnowledgeService,
  UploadKnowledgeService,
  CrawlKnowledgeService,
};
