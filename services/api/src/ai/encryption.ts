import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * API-key encryption for BYOA.
 *
 * AES-256-GCM with a random IV per call. The key is derived from
 * AI_KEY_ENCRYPTION_SECRET with scrypt, so the env var can be any long random
 * string rather than a fixed-length hex value — they are equally safe and
 * there is one less thing to get wrong during deployment.
 *
 * Stored format: `iv.authTag.ciphertext`, each part base64url.
 */

const SALT = "ziyarn-ai-config-v1";
const PREFIX = "v1";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, ivPart, tagPart, cipherPart] = payload.split(".");
  if (version !== PREFIX || !ivPart || !tagPart || !cipherPart) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(secret),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Never return a full key to the browser. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}
