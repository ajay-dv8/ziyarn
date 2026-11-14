import { createBlobKnowledgeStorage } from "@repo/api/knowledge/blob-storage";
import { createLocalKnowledgeStorage } from "@repo/api/knowledge/storage";
import { createReadKnowledgeService } from "@repo/api/knowledge/read-server";
import { createKnowledgeService } from "@repo/api/knowledge";

import { db } from "@repo/database";

import { authService } from "./auth-service";
import { resolveEmbedderForAgent } from "./embedding-service";

const storage = process.env.BLOB_READ_WRITE_TOKEN
  ? createBlobKnowledgeStorage()
  : createLocalKnowledgeStorage();

const serviceDeps = {
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  resolveEmbedder: resolveEmbedderForAgent,
  storage,
};

/** Lightweight read-only knowledge service. Does not import extract.ts or
 * crawler.ts, so routes using it (chat, document list, get, delete, crawl
 * status) do not trace the PDF/XLSX/DOCX extraction stack (~30 MB). */
export const readKnowledgeService = createReadKnowledgeService(serviceDeps);

/** Full knowledge service (read + upload + crawl). Imports extract.ts and
 * crawler.ts — only upload/crawl routes should use this. */
export const knowledgeService = createKnowledgeService(serviceDeps);
