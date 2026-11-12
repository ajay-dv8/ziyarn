import { describe, expect, it } from "vitest";

import {
  embeddingFingerprint,
  selectEmbeddingConfig,
} from "@repo/api/ai/server";

const platformModel = "gemini-embedding-001";

describe("selectEmbeddingConfig", () => {
  it("prefers the domain embedding model", () => {
    const account = { embeddingModel: "text-embedding-3-small" };
    const override = { embeddingModel: "text-embedding-3-large" };
    expect(selectEmbeddingConfig(account, override)).toBe(override);
  });

  it("falls back to the account when an override only changes chat", () => {
    const account: { embeddingModel: string | null } = {
      embeddingModel: "text-embedding-3-small",
    };
    const override: { embeddingModel: string | null } = {
      embeddingModel: null,
    };
    expect(selectEmbeddingConfig(account, override)).toBe(account);
  });

  it("uses platform embeddings when no scope sets a model", () => {
    expect(selectEmbeddingConfig({ embeddingModel: null }, null)).toBeNull();
    expect(selectEmbeddingConfig(null, { embeddingModel: null })).toBeNull();
    expect(selectEmbeddingConfig(null, null)).toBeNull();
  });
});

describe("embeddingFingerprint", () => {
  it("identifies the platform vector space", () => {
    expect(embeddingFingerprint(null, platformModel)).toBe(
      `platform:${platformModel}`,
    );
    expect(
      embeddingFingerprint(
        { provider: "openai", baseUrl: null, embeddingModel: null },
        platformModel,
      ),
    ).toBe(`platform:${platformModel}`);
  });

  it("changes when the embedding model changes", () => {
    const small = embeddingFingerprint(
      {
        provider: "openai",
        baseUrl: null,
        embeddingModel: "text-embedding-3-small",
      },
      platformModel,
    );
    const large = embeddingFingerprint(
      {
        provider: "openai",
        baseUrl: null,
        embeddingModel: "text-embedding-3-large",
      },
      platformModel,
    );
    expect(small).not.toBe(large);
  });

  it("changes when the same model name moves to another provider", () => {
    const openai = embeddingFingerprint(
      { provider: "openai", baseUrl: null, embeddingModel: "shared-model" },
      platformModel,
    );
    const custom = embeddingFingerprint(
      {
        provider: "custom",
        baseUrl: "https://llm.internal/v1",
        embeddingModel: "shared-model",
      },
      platformModel,
    );
    expect(openai).not.toBe(custom);
  });
});
