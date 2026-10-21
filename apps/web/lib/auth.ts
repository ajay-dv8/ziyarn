import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Auth, BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";

import { db } from "@repo/database";

import {
  AUTH_RATE_LIMIT,
  AUTH_TOKEN_TTL_SECONDS,
  buildTrustedOrigins,
} from "./auth-config";
import { authEmailSender } from "./auth-email";

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const useSecureCookies = baseURL.startsWith("https://");

const authConfig: BetterAuthOptions = {
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET || undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    // Do not hard-block existing users on day one. Unverified accounts can
    // sign in and see a resend banner in the dashboard instead.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: AUTH_TOKEN_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      await authEmailSender.sendPasswordReset({ user, token });
    },
  },
  emailVerification: {
    expiresIn: AUTH_TOKEN_TTL_SECONDS,
    sendOnSignUp: true,
    sendOnSignIn: false,
    // The link is opened on a page, then confirmed with a click. Signing the
    // user in after confirmation avoids a second trip through sign-in.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      await authEmailSender.sendVerification({ user, token });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: AUTH_RATE_LIMIT,
  trustedOrigins: buildTrustedOrigins(),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    },
  },
  advanced: {
    useSecureCookies,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecureCookies,
    },
  },
  plugins: [nextCookies()],
};

export const auth: Auth<typeof authConfig> = betterAuth(authConfig);
