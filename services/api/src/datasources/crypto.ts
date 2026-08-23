import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function encryptionKey(): Buffer {
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    process.env.DATABASE_URL ??
    "ziyarn-fallback-secret";
  return createHash("sha256").update(secret).digest();
}

/** Encrypts a JSON-serializable value into a single base64 blob (iv|tag|data). */
export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64");
}

/** Decrypts a blob produced by encryptJson. Throws when tampered. */
export function decryptJson<T>(blob: string): T {
  const raw = Buffer.from(blob, "base64");
  if (raw.length < 29) {
    throw new Error("Encrypted payload is malformed");
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}
