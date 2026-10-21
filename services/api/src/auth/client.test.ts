import { describe, expect, it, vi } from "vitest";

import {
  createAuthClientService,
  type AuthClient,
} from "@repo/api/auth/client";

function createClient(overrides: Record<string, unknown>): AuthClient {
  return overrides as unknown as AuthClient;
}

describe("auth client service lifecycle methods", () => {
  it("suppresses unknown-email and delivery errors on reset requests", async () => {
    const requestPasswordReset = vi.fn(async () => ({
      data: { status: true },
      error: { status: 500, message: "SMTP unavailable" },
    }));
    const service = createAuthClientService(
      createClient({ requestPasswordReset }),
    );

    const result = await service.requestPasswordReset({
      email: "nobody@example.com",
    });

    expect(result.error).toBeNull();
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "nobody@example.com",
    });
  });

  it("surfaces the rate limiter for reset requests", async () => {
    const service = createAuthClientService(
      createClient({
        requestPasswordReset: vi.fn(async () => ({
          data: null,
          error: { status: 429, message: "Too many requests" },
        })),
      }),
    );

    const result = await service.requestPasswordReset({
      email: "owner@example.com",
    });

    expect(result.error?.status).toBe(429);
  });

  it("maps the form password to Better Auth's newPassword field", async () => {
    const resetPassword = vi.fn(async () => ({
      data: { status: true },
      error: null,
    }));
    const service = createAuthClientService(createClient({ resetPassword }));

    const result = await service.resetPassword({
      token: "reset-token",
      password: "new-password-123",
    });

    expect(result.error).toBeNull();
    expect(resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "new-password-123",
    });
  });

  it("turns an expired reset token into an actionable message", async () => {
    const service = createAuthClientService(
      createClient({
        resetPassword: vi.fn(async () => ({
          data: null,
          error: { status: 400, message: "Invalid token" },
        })),
      }),
    );

    const result = await service.resetPassword({
      token: "expired",
      password: "new-password-123",
    });

    expect(result.error?.message).toContain("invalid or has expired");
  });

  it("sends verification tokens to the verify-email endpoint", async () => {
    const verifyEmail = vi.fn(async () => ({
      data: { status: true },
      error: null,
    }));
    const service = createAuthClientService(createClient({ verifyEmail }));

    const result = await service.verifyEmail("verify-token");

    expect(result.error).toBeNull();
    expect(verifyEmail).toHaveBeenCalledWith({
      query: { token: "verify-token" },
    });
  });
});
