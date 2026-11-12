import { describe, expect, it } from "vitest";

import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  BYO_PROVIDER_IDS,
  DEFAULT_AI_PROVIDER,
  aiProviderLabel,
  isAiProvider,
  resolveBaseUrl,
} from "@repo/api/ai/providers";
import { updateAiConfigSchema } from "@repo/api/ai/schemas";
import { selectEffectiveConfig } from "@repo/api/ai/server";

describe("the provider registry", () => {
  it("keeps the platform first, so it is the default", () => {
    expect(AI_PROVIDER_IDS[0]).toBe(DEFAULT_AI_PROVIDER);
    expect(DEFAULT_AI_PROVIDER).toBe("platform");
  });

  it("lists every provider as a BYO provider except the platform", () => {
    expect(BYO_PROVIDER_IDS).not.toContain("platform");
    expect(BYO_PROVIDER_IDS.length).toBe(AI_PROVIDER_IDS.length - 1);
  });

  it("gives every provider a label and a description", () => {
    for (const id of AI_PROVIDER_IDS) {
      expect(AI_PROVIDERS[id].label.length).toBeGreaterThan(0);
      expect(AI_PROVIDERS[id].description.length).toBeGreaterThan(0);
    }
  });

  it("recognises ids only", () => {
    expect(isAiProvider("openai")).toBe(true);
    expect(isAiProvider("OpenAI")).toBe(false);
    expect(isAiProvider("anthropic")).toBe(false);
    expect(isAiProvider(42)).toBe(false);
  });

  it("names a provider for the UI", () => {
    expect(aiProviderLabel("openrouter")).toBe("OpenRouter");
  });
});

describe("resolveBaseUrl", () => {
  it("uses the fixed URL for built-in providers", () => {
    expect(resolveBaseUrl("openai", "https://ignored.example.com")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("uses the owner's URL for a custom endpoint", () => {
    expect(resolveBaseUrl("custom", "https://llm.internal/v1")).toBe(
      "https://llm.internal/v1",
    );
  });

  it("has no URL for the platform", () => {
    expect(resolveBaseUrl("platform", null)).toBeNull();
  });
});

describe("selectEffectiveConfig", () => {
  it("prefers the domain override", () => {
    expect(
      selectEffectiveConfig({ provider: "platform" }, { provider: "openai" }),
    ).toEqual({ provider: "openai" });
  });

  it("falls back to the account config", () => {
    expect(selectEffectiveConfig({ provider: "openai" }, null)).toEqual({
      provider: "openai",
    });
  });

  it("returns null when nothing is configured", () => {
    expect(selectEffectiveConfig(null, null)).toBeNull();
    expect(selectEffectiveConfig(undefined, undefined)).toBeNull();
  });
});

describe("updateAiConfigSchema", () => {
  it("accepts the platform without a key or model", () => {
    expect(
      updateAiConfigSchema.safeParse({ provider: "platform" }).success,
    ).toBe(true);
  });

  it("accepts a provider with a model and key", () => {
    expect(
      updateAiConfigSchema.safeParse({
        provider: "openai",
        model: "gpt-4o-mini",
        apiKey: "sk-test-123456",
      }).success,
    ).toBe(true);
  });

  it("accepts a custom endpoint when the base URL is supplied", () => {
    expect(
      updateAiConfigSchema.safeParse({
        provider: "custom",
        model: "my-model",
        apiKey: "key-123456",
        baseUrl: "https://llm.internal/v1",
      }).success,
    ).toBe(true);
  });

  it("rejects a base URL without an http(s) scheme", () => {
    expect(
      updateAiConfigSchema.safeParse({
        provider: "custom",
        model: "my-model",
        apiKey: "key-123456",
        baseUrl: "llm.internal/v1",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown providers", () => {
    expect(
      updateAiConfigSchema.safeParse({ provider: "anthropic" }).success,
    ).toBe(false);
  });
});
