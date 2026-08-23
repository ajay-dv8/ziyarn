import { z } from "zod";

export const MAX_DOCUMENT_CHARS = 90_000;
export const MAX_DOCUMENT_CHUNKS = 100;

export const MAX_CRAWL_PAGES = 50;
export const MAX_CRAWL_DEPTH = 3;

export const createKnowledgeDocumentSchema = z.object({
  domainId: z.uuid(),
  agentId: z.uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z
    .string()
    .min(1)
    .max(MAX_DOCUMENT_CHARS, `Content exceeds ${MAX_DOCUMENT_CHARS} chars`),
});

export const listKnowledgeDocumentsSchema = z.object({
  domainId: z.uuid(),
  agentId: z.uuid(),
});

export const uploadFileSchema = z.object({
  domainId: z.uuid(),
  agentId: z.uuid(),
  fileName: z.string().trim().min(1).max(200),
  fileMime: z.string().trim().min(1).max(200),
  data: z.instanceof(Uint8Array),
});

export const getFileSchema = z.object({
  domainId: z.uuid(),
  documentId: z.uuid(),
});

export const deleteKnowledgeDocumentSchema = z.object({
  domainId: z.uuid(),
  documentId: z.uuid(),
});

export const queryKnowledgeSchema = z.object({
  agentId: z.uuid(),
  query: z.string().trim().min(1).max(1000),
  limit: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).optional(),
});

export const startCrawlSchema = z.object({
  domainId: z.uuid(),
  agentId: z.uuid(),
  url: z.url().max(2000),
});

export const crawlStatusSchema = z.object({
  domainId: z.uuid(),
  agentId: z.uuid(),
});

export type CreateKnowledgeDocumentInput = z.infer<
  typeof createKnowledgeDocumentSchema
>;
export type ListKnowledgeDocumentsInput = z.infer<
  typeof listKnowledgeDocumentsSchema
>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type GetFileInput = z.infer<typeof getFileSchema>;
export type DeleteKnowledgeDocumentInput = z.infer<
  typeof deleteKnowledgeDocumentSchema
>;
export type QueryKnowledgeInput = z.infer<typeof queryKnowledgeSchema>;
export type StartCrawlInput = z.infer<typeof startCrawlSchema>;
export type CrawlStatusInput = z.infer<typeof crawlStatusSchema>;
