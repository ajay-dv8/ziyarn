import type { BetterAuthOptions } from "better-auth";

import { API_ROUTES } from "@repo/routes";

/** Verification and reset links both live for one hour. */
export const AUTH_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Better Auth's rate-limit keys are relative to its mount point. Strip the
 * `/api/auth` prefix from the shared constants instead of duplicating paths.
 */
function authEndpoint(path: string): string {
  return path.slice(API_ROUTES.auth.root.length);
}

/**
 * Better Auth compares the browser Origin against this list for state-changing
 * auth endpoints. Keep request-time env reads out of the config object so a
 * preview deployment can be pointed at its own origin without a code change.
 */
export function buildTrustedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const configured = [
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_BETTER_AUTH_URL,
    env.BASE_APP_URL,
    ...(env.TRUSTED_ORIGINS?.split(",") ?? []),
  ];

  const origins = new Set<string>();
  for (const value of configured) {
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  }

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }

  if (origins.size === 0) {
    origins.add("http://localhost:3000");
  }

  return [...origins];
}

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Better Auth accepts wildcard patterns; URL() would reject them.
  if (trimmed.includes("*")) {
    return trimmed.replace(/\/+$/, "");
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * Explicit auth limits. The sign-in and reset rules are intentionally tighter
 * than the global bucket; they are the credential-stuffing and mail-bombing
 * surfaces. Better Auth stores these in memory, so they are per-instance.
 */
export const AUTH_RATE_LIMIT = {
  enabled: true,
  window: 60,
  max: 300,
  customRules: {
    [authEndpoint(API_ROUTES.auth.signInEmail)]: { window: 15 * 60, max: 10 },
    [authEndpoint(API_ROUTES.auth.signInSocial)]: { window: 15 * 60, max: 20 },
    [authEndpoint(API_ROUTES.auth.signUpEmail)]: { window: 60 * 60, max: 5 },
    [authEndpoint(API_ROUTES.auth.requestPasswordReset)]: {
      window: 15 * 60,
      max: 3,
    },
    [authEndpoint(API_ROUTES.auth.resetPassword)]: {
      window: 15 * 60,
      max: 5,
    },
    [authEndpoint(API_ROUTES.auth.sendVerificationEmail)]: {
      window: 15 * 60,
      max: 3,
    },
    [authEndpoint(API_ROUTES.auth.verifyEmail)]: {
      window: 15 * 60,
      max: 10,
    },
    [authEndpoint(API_ROUTES.auth.changePassword)]: {
      window: 15 * 60,
      max: 5,
    },
    [authEndpoint(API_ROUTES.auth.changeEmail)]: {
      window: 60 * 60,
      max: 3,
    },
    [authEndpoint(API_ROUTES.auth.deleteUser)]: {
      window: 60 * 60,
      max: 3,
    },
  },
} satisfies NonNullable<BetterAuthOptions["rateLimit"]>;
