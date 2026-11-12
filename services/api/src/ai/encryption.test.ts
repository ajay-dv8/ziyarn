import { describe, expect, it } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  maskApiKey,
} from "@repo/api/ai/encryption";

const SECRET = "test-encryption-secret-for-byoa";

describe("encryptSecret", () => {
  it("round-trips a key without leaving it in the ciphertext", () => {
    const plaintext = "sk-live-1234567890abcdef";
    const ciphertext = encryptSecret(plaintext, SECRET);

    expect(ciphertext).not.toContain(plaintext);
    expect(decryptSecret(ciphertext, SECRET)).toBe(plaintext);
  });

  it("uses a fresh IV for every call", () => {
    expect(encryptSecret("same-input", SECRET)).not.toBe(
      encryptSecret("same-input", SECRET),
    );
  });

  it("rejects the wrong secret", () => {
    const ciphertext = encryptSecret("secret-value", SECRET);
    expect(() => decryptSecret(ciphertext, "another-secret")).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encryptSecret("secret-value", SECRET);
    const parts = ciphertext.split(".");
    const lastPart = parts[parts.length - 1] ?? "";
    parts[parts.length - 1] =
      (lastPart.startsWith("A") ? "B" : "A") + lastPart.slice(1);
    expect(() => decryptSecret(parts.join("."), SECRET)).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decryptSecret("not-a-payload", SECRET)).toThrow();
  });
});

describe("maskApiKey", () => {
  it("keeps only a short prefix and suffix", () => {
    expect(maskApiKey("sk-abc123456789")).toBe("sk-…6789");
  });

  it("never reveals a short key", () => {
    expect(maskApiKey("short")).toBe("••••••••");
  });
});
