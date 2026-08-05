import { z } from "zod";

export const MAX_DOCUMENT_CHARS = 90_000;
export const MAX_DOCUMENT_CHUNKS = 100;

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

export type CreateKnowledgeDocumentInput = z.infer<
  typeof createKnowledgeDocumentSchema
>;
export type ListKnowledgeDocumentsInput = z.infer<
  typeof listKnowledgeDocumentsSchema
>;
export type DeleteKnowledgeDocumentInput = z.infer<
  typeof deleteKnowledgeDocumentSchema
>;
export type QueryKnowledgeInput = z.infer<typeof queryKnowledgeSchema>;
