import { describe, expect, it } from "vitest";

import { API_ROUTES } from "@repo/routes";

import { AUTH_RATE_LIMIT, buildTrustedOrigins } from "./auth-config";

describe("buildTrustedOrigins", () => {
  it("normalizes, deduplicates, and includes configured origins", () => {
    const origins = buildTrustedOrigins({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://app.example.com/",
      NEXT_PUBLIC_BETTER_AUTH_URL: "https://app.example.com",
      BASE_APP_URL: "https://app.example.com/path",
      TRUSTED_ORIGINS: "https://preview.example.com, https://admin.example.com",
    });

    expect(origins).toEqual([
      "https://app.example.com",
      "https://preview.example.com",
      "https://admin.example.com",
    ]);
  });

  it("adds localhost only outside production", () => {
    expect(
      buildTrustedOrigins({
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://localhost:3000",
      }),
    ).toEqual(["http://localhost:3000"]);

    expect(
      buildTrustedOrigins({
        NODE_ENV: "production",
        BETTER_AUTH_URL: "https://app.example.com",
      }),
    ).toEqual(["https://app.example.com"]);
  });

  it("keeps wildcard patterns and ignores malformed values", () => {
    const origins = buildTrustedOrigins({
      NODE_ENV: "production",
      TRUSTED_ORIGINS: "https://*.example.com,not a url",
    });

    expect(origins).toContain("https://*.example.com");
    expect(origins).not.toContain("not a url");
  });
});

describe("AUTH_RATE_LIMIT", () => {
  it("limits the credential and mail-sending endpoints", () => {
    expect(AUTH_RATE_LIMIT.enabled).toBe(true);
    expect(
      AUTH_RATE_LIMIT.customRules[
        API_ROUTES.auth.signInEmail.slice(API_ROUTES.auth.root.length)
      ],
    ).toEqual({
      window: 15 * 60,
      max: 10,
    });
    expect(
      AUTH_RATE_LIMIT.customRules[
        API_ROUTES.auth.requestPasswordReset.slice(API_ROUTES.auth.root.length)
      ],
    ).toEqual({
      window: 15 * 60,
      max: 3,
    });
    expect(
      AUTH_RATE_LIMIT.customRules[
        API_ROUTES.auth.sendVerificationEmail.slice(API_ROUTES.auth.root.length)
      ],
    ).toEqual({
      window: 15 * 60,
      max: 3,
    });
  });
});
