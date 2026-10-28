import { describe, expect, it } from "vitest";

import {
  customerFacingAiErrorMessage,
  systemPromptFor,
} from "@repo/api/chat/server";

describe("customerFacingAiErrorMessage", () => {
  it("replaces a provider 429 with a calm retry message", () => {
    const providerError = Object.assign(
      new Error("429 status code (no body)"),
      { status: 429 },
    );

    const message = customerFacingAiErrorMessage(providerError);

    expect(message).toBe(
      "I'm a bit busy right now. Please try again in a moment.",
    );
    expect(message).not.toContain("429");
  });

  it("hides raw provider details for any other failure", () => {
    const message = customerFacingAiErrorMessage(
      new Error("Connection error."),
    );

    expect(message).toBe("I couldn't finish that reply. Please try again.");
    expect(message).not.toContain("Connection error");
  });

  it("never echoes the original message, even for non-Error throws", () => {
    expect(customerFacingAiErrorMessage("boom")).toBe(
      "I couldn't finish that reply. Please try again.",
    );
  });

  it("hides model unavailability and offers the human handoff instead", () => {
    const providerError = Object.assign(
      new Error(
        "404 This model is unavailable for free. The paid version is available now - use this slug instead: openai/gpt-oss-20b",
      ),
      { status: 404 },
    );

    const message = customerFacingAiErrorMessage(providerError);

    expect(message).not.toContain("unavailable for free");
    expect(message).not.toContain("gpt-oss-20b");
    expect(message).not.toContain("paid version");
    expect(message).toContain("human agent");
  });
});

describe("systemPromptFor", () => {
  it("tells the model to use only supplied source URLs", () => {
    const prompt = systemPromptFor(
      { slug: "urban-plus-2", businessType: "ecommerce" },
      {
        name: "Urban+",
        description: null,
        instructions: null,
        systemPrompt: null,
        tools: null,
        filterQuestions: null,
      },
      [],
    );

    expect(prompt).toContain("Source URL");
    expect(prompt).toContain("Never invent, guess, or construct URLs");
    expect(prompt).toContain("domain slug");
  });
});
