import { del, get, put } from "@vercel/blob";

import type { KnowledgeFileStorage } from "@repo/api/knowledge/storage";

/**
 * App-owned file storage backed by Vercel Blob for production. Blobs are
 * private unless `access` is overridden; downloads go through the SDK's
 * `get`, which authenticates with BLOB_READ_WRITE_TOKEN (or OIDC). The key
 * is stored as the blob pathname, so the same `storage_key` works for both
 * this and the local-disk implementation.
 */
export function createBlobKnowledgeStorage(
  access: "public" | "private" = "private",
): KnowledgeFileStorage {
  return {
    async save(key, data) {
      await put(key, Buffer.from(data), { access, allowOverwrite: true });
    },
    async load(key) {
      const result = await get(key, { access });
      if (!result || result.statusCode !== 200) return null;
      const bytes = await new Response(result.stream).arrayBuffer();
      return new Uint8Array(bytes);
    },
    async remove(key) {
      await del(key);
    },
  };
}
