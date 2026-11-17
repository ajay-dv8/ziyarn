import { describe, expect, it } from "vitest";

import { updateAgentSchema } from "@repo/api/agents/schemas";

describe("updateAgentSchema temperature", () => {
  it("accepts the supported range and the provider default", () => {
    expect(updateAgentSchema.safeParse({ temperature: 0 }).success).toBe(true);
    expect(updateAgentSchema.safeParse({ temperature: 2 }).success).toBe(true);
    expect(updateAgentSchema.safeParse({ temperature: null }).success).toBe(
      true,
    );
  });

  it("rejects values outside the supported range", () => {
    expect(updateAgentSchema.safeParse({ temperature: -0.1 }).success).toBe(
      false,
    );
    expect(updateAgentSchema.safeParse({ temperature: 2.1 }).success).toBe(
      false,
    );
  });
});
