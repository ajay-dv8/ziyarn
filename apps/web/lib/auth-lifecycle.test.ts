import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "@repo/routes";

const TEST_SECRET = "test-secret-".padEnd(64, "x");
const EMAIL = "owner@example.com";
const PASSWORD = "initial-password";

type MemoryRow = Record<string, unknown>;
type MemoryDb = Record<string, MemoryRow[]>;

function createTestAuth(options?: {
  resetPasswordTokenExpiresIn?: number;
  verificationExpiresIn?: number;
}) {
  const memoryDb: MemoryDb = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const resetTokens: string[] = [];
  const verificationTokens: string[] = [];
  const sendReset = vi.fn(async (input: { token: string }) => {
    resetTokens.push(input.token);
  });
  const sendVerification = vi.fn(async (input: { token: string }) => {
    verificationTokens.push(input.token);
  });

  const auth = betterAuth({
    baseURL: "http://localhost:3000",
    secret: TEST_SECRET,
    database: memoryAdapter(memoryDb),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn:
        options?.resetPasswordTokenExpiresIn ?? 60 * 60,
      sendResetPassword: sendReset,
    },
    emailVerification: {
      expiresIn: options?.verificationExpiresIn ?? 60 * 60,
      sendVerificationEmail: sendVerification,
    },
    rateLimit: { enabled: false },
    advanced: { useSecureCookies: false },
  });

  return { auth, memoryDb, resetTokens, verificationTokens, sendReset };
}

async function signUp(auth: ReturnType<typeof createTestAuth>["auth"]) {
  await auth.api.signUpEmail({
    body: {
      name: "Test Owner",
      email: EMAIL,
      password: PASSWORD,
    },
  });
}

describe("auth rate limiting", () => {
  it("returns 429 after repeated failed sign-ins from one IP", async () => {
    const memoryDb: MemoryDb = {
      user: [],
      session: [],
      account: [],
      verification: [],
    };
    const auth = betterAuth({
      baseURL: "http://localhost:3000",
      secret: TEST_SECRET,
      database: memoryAdapter(memoryDb),
      emailAndPassword: { enabled: true, minPasswordLength: 8 },
      rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        customRules: {
          [API_ROUTES.auth.signInEmail.slice(API_ROUTES.auth.root.length)]: {
            window: 60,
            max: 3,
          },
        },
      },
      advanced: {
        disableOriginCheck: true,
        useSecureCookies: false,
      },
    });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.77",
          },
          body: JSON.stringify({
            email: EMAIL,
            password: "wrong-password",
          }),
        }),
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses[3]).toBe(429);
  });
});

describe("auth lifecycle", () => {
  it("resets a password once and consumes the token", async () => {
    const { auth, resetTokens } = createTestAuth();
    await signUp(auth);

    const request = await auth.api.requestPasswordReset({
      body: { email: EMAIL },
    });
    expect(request.status).toBe(true);
    expect(resetTokens).toHaveLength(1);

    const token = resetTokens[0];
    if (!token) throw new Error("reset token was not captured");

    await auth.api.resetPassword({
      body: { newPassword: "new-password-123", token },
    });

    await expect(
      auth.api.resetPassword({
        body: { newPassword: "another-password-123", token },
      }),
    ).rejects.toThrow();

    const signIn = await auth.api.signInEmail({
      body: { email: EMAIL, password: "new-password-123" },
    });
    expect(signIn.user.email).toBe(EMAIL);
  });

  it("rejects an expired reset token", async () => {
    const { auth, memoryDb, resetTokens } = createTestAuth();
    await signUp(auth);

    await auth.api.requestPasswordReset({ body: { email: EMAIL } });
    const token = resetTokens[0];
    if (!token) throw new Error("reset token was not captured");

    const verificationRow = memoryDb.verification?.find(
      (row) => row.identifier === `reset-password:${token}`,
    );
    if (!verificationRow) throw new Error("verification row not found");
    verificationRow.expiresAt = new Date(Date.now() - 1_000);

    await expect(
      auth.api.resetPassword({
        body: { newPassword: "new-password-123", token },
      }),
    ).rejects.toThrow();
  });

  it("returns the same generic response for an unknown email", async () => {
    const { auth, sendReset } = createTestAuth();

    const response = await auth.api.requestPasswordReset({
      body: { email: "nobody@example.com" },
    });

    expect(response.status).toBe(true);
    expect(response.message).toContain("If this email exists");
    expect(sendReset).not.toHaveBeenCalled();
  });

  it("verifies an email address from a generated token", async () => {
    const { auth, memoryDb, verificationTokens } = createTestAuth();
    await signUp(auth);

    await auth.api.sendVerificationEmail({ body: { email: EMAIL } });
    const token = verificationTokens[0];
    if (!token) throw new Error("verification token was not captured");

    const result = await auth.api.verifyEmail({ query: { token } });
    if (!result) throw new Error("verification returned no result");
    expect(result.status).toBe(true);

    const user = memoryDb.user?.find((row) => row.email === EMAIL);
    expect(user?.emailVerified).toBe(true);
  });

  it("rejects an expired verification token", async () => {
    const { auth, verificationTokens } = createTestAuth({
      verificationExpiresIn: -1,
    });
    await signUp(auth);

    await auth.api.sendVerificationEmail({ body: { email: EMAIL } });
    const token = verificationTokens[0];
    if (!token) throw new Error("verification token was not captured");

    await expect(auth.api.verifyEmail({ query: { token } })).rejects.toThrow();
  });
});
