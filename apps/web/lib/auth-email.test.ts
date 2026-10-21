import { describe, expect, it, vi } from "vitest";

import { APP_ROUTES } from "@repo/routes";

import { createAuthEmailSender } from "./auth-email";

const USER = { email: "owner@example.com", name: "Test $& Owner" };

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

describe("auth email sender", () => {
  it("builds verification links on the configured public app URL", async () => {
    const send = vi.fn(async (input: EmailMessage) => ({
      ok: input.to.length > 0,
    }));
    const sender = createAuthEmailSender({
      send,
      appUrl: "https://app.example.com/",
      ttlSeconds: 3600,
    });

    await sender.sendVerification({ user: USER, token: "token+with/slash" });

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0]?.[0];
    expect(message?.to).toBe(USER.email);
    expect(message?.subject).toBe("Verify your email address");
    expect(message?.text).toContain(
      `https://app.example.com${APP_ROUTES.VERIFY_EMAIL}?token=token%2Bwith%2Fslash`,
    );
    expect(message?.html).toContain("Verify email");
    expect(message?.html).toContain("expires in 1 hour");
    expect(message?.html).toContain("Hi Test $&amp; Owner,");
    expect(message?.html).not.toContain("__BODY__");
    expect(message?.text).toContain("Hi Test $& Owner,");
  });

  it("builds password reset links and uses the reset template", async () => {
    const send = vi.fn(async (input: EmailMessage) => ({
      ok: input.to.length > 0,
    }));
    const sender = createAuthEmailSender({
      send,
      appUrl: "https://app.example.com",
      ttlSeconds: 3600,
    });

    await sender.sendPasswordReset({ user: USER, token: "reset-token" });

    const message = send.mock.calls[0]?.[0];
    expect(message?.subject).toBe("Reset your Ziyarn password");
    expect(message?.text).toContain(
      `https://app.example.com${APP_ROUTES.RESET_PASSWORD}?token=reset-token`,
    );
    expect(message?.text).toContain("can only be used once");
  });

  it("does not throw when SMTP delivery fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sender = createAuthEmailSender({
      send: vi.fn(async () => ({ ok: false })),
      appUrl: "https://app.example.com",
    });

    await expect(
      sender.sendVerification({ user: USER, token: "token" }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      "Auth email delivery failed: verification",
    );

    errorSpy.mockRestore();
  });
});
