import { describe, expect, it, vi } from "vitest";

import { handleChatPost, type ChatService } from "@repo/api/chat/server";

const conversationId = "11111111-1111-4111-8111-111111111111";

function createChatService(
  appendMessage: ReturnType<typeof vi.fn>,
  status: "active" | "escalated" | "resolved" | "closed" = "escalated",
  extra: Record<string, unknown> = {},
) {
  return {
    resolveDomainBySecret: async () => ({
      id: "domain-1",
      slug: "demo",
      plan: "free",
      businessType: "ecommerce",
    }),
    defaultAgentForDomain: async () => ({ id: "agent-1" }),
    // Both the request validation and the post-append status check read it.
    getConversationForDomain: async () => ({
      id: conversationId,
      status,
    }),
    appendMessage,
    ...extra,
  } as unknown as ChatService;
}

function chatRequest(message: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-embed-secret": "secret",
    },
    body: JSON.stringify({
      conversationId,
      visitorId: "visitor-123",
      message,
    }),
  });
}

describe("handleChatPost escalation pause", () => {
  it("stores the visitor message and skips the AI while escalated", async () => {
    const appendMessage = vi.fn().mockResolvedValue({ id: "message-1" });
    const streamChat = vi.fn();

    const response = await handleChatPost(
      createChatService(appendMessage),
      {} as never,
      chatRequest("Can a human answer this?"),
      {
        aiService: { isConfigured: true, streamChat } as never,
        portalService: {} as never,
        knowledgeService: {} as never,
        chatRateLimiter: { check: () => true },
        logger: { info: vi.fn(), error: vi.fn() } as never,
      },
    );

    const body = await response.text();
    expect(appendMessage).toHaveBeenCalledWith(conversationId, {
      role: "user",
      content: "Can a human answer this?",
    });
    expect(streamChat).not.toHaveBeenCalled();
    expect(body).toContain('"type":"done"');
    expect(body).toContain('"escalated":true');
  });

  it("reopens a resolved conversation and lets the AI answer again", async () => {
    const appendMessage = vi.fn().mockResolvedValue({ id: "message-1" });
    const setConversationStatus = vi.fn().mockResolvedValue(undefined);
    const streamChat = vi.fn(async function* () {
      yield { type: "text", delta: "Hi! How can I help?" };
    });

    const response = await handleChatPost(
      createChatService(appendMessage, "resolved", {
        setConversationStatus,
        contextMessages: async () => [],
        getProductCatalog: async () => [],
        getBookingConfig: async () => null,
      }),
      {} as never,
      chatRequest("hi"),
      {
        aiService: { isConfigured: true, streamChat } as never,
        portalService: {} as never,
        knowledgeService: {} as never,
        chatRateLimiter: { check: () => true },
        logger: { info: vi.fn(), error: vi.fn() } as never,
      },
    );

    expect(setConversationStatus).toHaveBeenCalledWith(
      conversationId,
      "active",
    );
    expect(streamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("that handoff is over"),
      }),
    );
    const body = await response.text();
    expect(body).toContain('"type":"text"');
    expect(body).toContain('"type":"done"');
  });

  it("passes the agent's creativity setting to the AI", async () => {
    const appendMessage = vi.fn().mockResolvedValue({ id: "message-1" });
    const streamChat = vi.fn(async function* () {
      yield { type: "text", delta: "Hi! How can I help?" };
    });

    const response = await handleChatPost(
      createChatService(appendMessage, "active", {
        defaultAgentForDomain: async () => ({
          id: "agent-1",
          temperature: 1.3,
        }),
        contextMessages: async () => [],
        getProductCatalog: async () => [],
        getBookingConfig: async () => null,
      }),
      {} as never,
      chatRequest("hi"),
      {
        aiService: { isConfigured: true, streamChat } as never,
        portalService: {} as never,
        knowledgeService: {} as never,
        chatRateLimiter: { check: () => true },
        logger: { info: vi.fn(), error: vi.fn() } as never,
      },
    );

    await response.text();
    expect(streamChat).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 1.3 }),
    );
  });
});
