import { PDFParse } from "pdf-parse";

import { MAX_DOCUMENT_CHARS } from "@repo/api/knowledge/schemas";

export const MAX_UPLOAD_BYTES = Math.floor(4.45 * 1024 * 1024);

export type SupportedFileType = "pdf" | "txt" | "md" | "html";

const EXTENSION_TO_TYPE: Record<string, SupportedFileType> = {
  pdf: "pdf",
  txt: "txt",
  md: "md",
  markdown: "md",
  html: "html",
  htm: "html",
};

export function detectFileType(fileName: string): SupportedFileType | null {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return null;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return EXTENSION_TO_TYPE[extension] ?? null;
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "file" : fileName.slice(dot + 1).toLowerCase() || "file";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const PAGE_MARKER = /^--\s*\d+\s+of\s+\d+\s*--$/gm;

/**
 * Extracts plain text from an uploaded file. Supports PDF (pdf-parse),
 * plain text, Markdown, and HTML (tags stripped). Returns null for
 * unsupported files; throws with a friendly message when content exceeds
 * the document size limit.
 */
export async function extractFileText(
  type: SupportedFileType,
  fileName: string,
  buffer: Uint8Array,
): Promise<string> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Files must be 4.45 MB or smaller`);
  }

  let text: string;
  switch (type) {
    case "pdf": {
      const parser = new PDFParse({ data: Buffer.from(buffer) });
      try {
        const result = await parser.getText();
        text = result.text.replace(PAGE_MARKER, "").replace(/\n{3,}/g, "\n\n");
      } finally {
        await parser.destroy();
      }
      break;
    }
    case "txt":
      text = new TextDecoder().decode(buffer);
      break;
    case "md":
      text = new TextDecoder().decode(buffer);
      break;
    case "html":
      text = stripHtml(new TextDecoder().decode(buffer));
      break;
  }

  const clean = text.trim();
  if (clean.length === 0) {
    throw new Error(`No readable text found in ${fileName}`);
  }
  if (clean.length > MAX_DOCUMENT_CHARS) {
    throw new Error(
      `Extracted text is ${clean.length} chars (max ${MAX_DOCUMENT_CHARS}). Use a smaller or shorter file.`,
    );
  }
  return clean;
}
