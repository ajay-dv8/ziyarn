import { randomUUID } from "node:crypto";

import type { Database } from "@repo/database";
import {
  detectFileType,
  extensionOf,
  extractFileText,
} from "@repo/api/knowledge/extract";
import type { KnowledgeFileStorage } from "@repo/api/knowledge/storage";
import {
  createKnowledgeDocumentSchema,
  uploadFileSchema,
} from "@repo/api/knowledge/schemas";
import { KnowledgeServiceError } from "@repo/api/knowledge/errors";
import { createOwnershipChecks } from "@repo/api/knowledge/read-server";
import { ingestContent } from "@repo/api/knowledge/ingest";

/**
 * Write operations for knowledge file uploads. Imports `extract.ts` which
 * pulls in the PDF/XLSX/DOCX extraction stack (including the ~30 MB
 * `@napi-rs/canvas` binary). Only upload/crawl routes should import this.
 */
export function createUploadKnowledgeService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<{
    user: { id: string };
    email?: string;
  } | null>;
  resolveEmbedder: (agentId: string) => Promise<{
    embed: (texts: string[]) => Promise<number[][]>;
    model: string;
  }>;
  storage: KnowledgeFileStorage;
}) {
  const { db, getSession, resolveEmbedder, storage } = deps;
  const { requireOwnedAgent } = createOwnershipChecks({ db, getSession });

  /** Pastes text content as a knowledge document. */
  const uploadDocument = async (
    input: {
      domainId: string;
      agentId: string;
      title?: string;
      content: string;
    },
    headers: Headers,
  ) => {
    const body = createKnowledgeDocumentSchema.parse(input);
    await requireOwnedAgent(body.domainId, body.agentId, headers);
    const embedder = await resolveEmbedder(body.agentId);
    return ingestContent({ db, embedder }, body.agentId, body.content, body.title);
  };

  /** Uploads a file as a knowledge document: stores the original in
   * app-owned storage, extracts text, and runs the same chunk/embed
   * pipeline as paste uploads. */
  const uploadFile = async (
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
    const embedder = await resolveEmbedder(parsed.agentId);

    const type = detectFileType(parsed.fileName);
    if (!type) {
      throw new KnowledgeServiceError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "Supported files: PDF, TXT, MD, HTML, DOC, DOCX, XLS, XLSX",
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
      return await ingestContent({ db, embedder }, parsed.agentId, content, parsed.fileName, {
        fileName: parsed.fileName,
        fileMime: parsed.fileMime,
        fileSize: parsed.data.byteLength,
        storageKey,
      });
    } catch (error) {
      await storage.remove(storageKey);
      throw error;
    }
  };

  return {
    uploadDocument,
    uploadFile,
  };
}

export type UploadKnowledgeService = ReturnType<
  typeof createUploadKnowledgeService
>;
