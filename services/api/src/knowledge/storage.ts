import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * App-owned file storage for uploaded knowledge documents. In local dev the
 * files land in STORAGE_DIR (default `<cwd>/.uploads`, gitignored). Swapping
 * in S3/Blob for production means implementing this same interface with the
 * provider's SDK.
 */
export type KnowledgeFileStorage = {
  save(key: string, data: Uint8Array): Promise<void>;
  load(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
};

export function createLocalKnowledgeStorage(): KnowledgeFileStorage {
  const dir =
    process.env.STORAGE_DIR ?? path.join(process.cwd(), ".uploads", "knowledge");

  const resolve = (key: string) => {
    const filePath = path.join(dir, key);
    if (!filePath.startsWith(dir)) {
      throw new Error("Invalid storage key");
    }
    return filePath;
  };

  return {
    async save(key, data) {
      const filePath = resolve(key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.from(data));
    },
    async load(key) {
      try {
        return await readFile(resolve(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(key) {
      try {
        await unlink(resolve(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}
