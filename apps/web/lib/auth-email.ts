import {
  passwordResetEmailTemplate,
  sendTransactional,
  verificationEmailTemplate,
  type SendTransactional,
} from "@repo/api/email";
import { APP_ROUTES } from "@repo/routes";

import { AUTH_TOKEN_TTL_SECONDS } from "./auth-config";

type AuthEmailSenderDeps = {
  send: SendTransactional;
  appUrl: string;
  ttlSeconds?: number;
};

type AuthEmailUser = {
  email: string;
  name?: string | null;
};

function normalizeAppUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildLink(appUrl: string, route: string, token: string): string {
  return `${normalizeAppUrl(appUrl)}${route}?token=${encodeURIComponent(token)}`;
}

/**
 * Builds the account emails from the same SMTP path as campaigns and portal
 * mail. Delivery failures are logged without the address or token and never
 * fail sign-up or password-reset requests.
 */
export function createAuthEmailSender(deps: AuthEmailSenderDeps) {
  const ttlSeconds = deps.ttlSeconds ?? AUTH_TOKEN_TTL_SECONDS;
  const expiresInMinutes = Math.round(ttlSeconds / 60);

  async function deliver(input: {
    to: string;
    message: { subject: string; text: string; html: string };
    kind: "verification" | "password-reset";
  }): Promise<void> {
    try {
      const result = await deps.send({
        to: input.to,
        subject: input.message.subject,
        text: input.message.text,
        html: input.message.html,
      });
      if (!result.ok) {
        console.error(`Auth email delivery failed: ${input.kind}`);
      }
    } catch (error) {
      console.error(
        `Auth email delivery failed: ${input.kind}`,
        error instanceof Error ? error.name : "unknown error",
      );
    }
  }

  return {
    async sendVerification(input: {
      user: AuthEmailUser;
      token: string;
    }): Promise<void> {
      const verifyUrl = buildLink(
        deps.appUrl,
        APP_ROUTES.VERIFY_EMAIL,
        input.token,
      );
      const message = verificationEmailTemplate({
        name: input.user.name ?? null,
        verifyUrl,
        expiresInMinutes,
      });
      await deliver({
        to: input.user.email,
        message,
        kind: "verification",
      });
    },

    async sendPasswordReset(input: {
      user: AuthEmailUser;
      token: string;
    }): Promise<void> {
      const resetUrl = buildLink(
        deps.appUrl,
        APP_ROUTES.RESET_PASSWORD,
        input.token,
      );
      const message = passwordResetEmailTemplate({
        name: input.user.name ?? null,
        resetUrl,
        expiresInMinutes,
      });
      await deliver({
        to: input.user.email,
        message,
        kind: "password-reset",
      });
    },
  };
}

export const authEmailSender = createAuthEmailSender({
  send: sendTransactional,
  appUrl:
    process.env.BASE_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000",
});
