import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs/config";
import { createMDX } from "fumadocs-mdx/next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX();

const isProductionBuild = process.env.NODE_ENV === "production";
const isVercelPreview = process.env.VERCEL_ENV === "preview";

/** Origin of a URL string, or null when unset/invalid. */
function originOf(value) {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

// Sentry's browser SDK posts to its ingest host. Derive it from the DSN so a
// non-US region keeps working; the wildcards cover the regions Sentry
// documents in case the DSN is only present at runtime.
const sentryOrigins = [
  originOf(process.env.NEXT_PUBLIC_SENTRY_DSN),
  originOf(process.env.SENTRY_DSN),
  "https://*.ingest.sentry.io",
  "https://*.ingest.us.sentry.io",
  "https://*.ingest.de.sentry.io",
].filter(
  (origin, index, origins) => origin && origins.indexOf(origin) === index,
);

// Report-Only until a clean window in production, then rename the header to
// Content-Security-Policy. Known browser-side sources:
// - inline scripts/styles: Next.js bootstrap + next-themes + JSON-LD
// - https: images: OAuth avatars (Google, LinkedIn) via <AvatarImage>
// - Paystack Inline: fetches api.paystack.co and frames checkout.paystack.com
// Keep in sync with apps/admin/next.config.js.
const connectSources = [
  "'self'",
  originOf(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
  "https://api.paystack.co",
  "https://checkout.paystack.com",
  ...sentryOrigins,
].filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' https://checkout.paystack.com",
  `connect-src ${connectSources.join(" ")}`,
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // frame-ancestors in the CSP covers modern browsers; this covers legacy ones.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProductionBuild
    ? [
        {
          key: "Content-Security-Policy-Report-Only",
          value: contentSecurityPolicy,
        },
      ]
    : []),
  // Never HSTS on preview URLs: pinning a preview host in one browser would
  // poison every later preview. HSTS over plain HTTP is ignored, so running
  // `next start` locally is unaffected.
  ...(isProductionBuild && !isVercelPreview
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(withMDX(nextConfig), {
  org: process.env.SENTRY_ORG || "ajay-w6",
  project: process.env.SENTRY_PROJECT || "ziyarn",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  silent: !process.env.CI,
});
