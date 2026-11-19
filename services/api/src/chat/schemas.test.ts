import { describe, expect, it } from "vitest";

import {
  conversationIdParamSchema,
  conversationListSchema,
} from "@repo/api/chat/schemas";

const DOMAIN_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

describe("conversationListSchema", () => {
  it("accepts the All domains scope", () => {
    expect(conversationListSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a domain uuid", () => {
    const parsed = conversationListSchema.safeParse({ domainId: DOMAIN_ID });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.domainId).toBe(DOMAIN_ID);
  });

  it("rejects a non-uuid domain filter before it reaches the query", () => {
    expect(conversationListSchema.safeParse({ domainId: "acme" }).success).toBe(
      false,
    );
  });
});

describe("conversationIdParamSchema", () => {
  it("accepts a conversation uuid", () => {
    expect(conversationIdParamSchema.safeParse(CONVERSATION_ID).success).toBe(
      true,
    );
  });

  it("rejects a non-uuid deep link", () => {
    expect(conversationIdParamSchema.safeParse("latest").success).toBe(false);
  });
});
