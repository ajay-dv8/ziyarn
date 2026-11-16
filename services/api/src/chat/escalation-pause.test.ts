import { describe, expect, it, vi } from "vitest";

import { handleChatPost, type ChatService } from "@repo/api/chat/server";

const conversationId = "11111111-1111-4111-8111-111111111111";

function createChatService(appendMessage: ReturnType<typeof vi.fn>) {
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
      status: "escalated",
    }),
    appendMessage,
  } as unknown as ChatService;
}

describe("handleChatPost escalation pause", () => {
  it("stores the visitor message and skips the AI while escalated", async () => {
    const appendMessage = vi.fn().mockResolvedValue({ id: "message-1" });
    const streamChat = vi.fn();

    const response = await handleChatPost(
      createChatService(appendMessage),
      {} as never,
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-embed-secret": "secret",
        },
        body: JSON.stringify({
          conversationId,
          visitorId: "visitor-123",
          message: "Can a human answer this?",
        }),
      }),
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
});
