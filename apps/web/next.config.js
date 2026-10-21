import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs/config";
import { createMDX } from "fumadocs-mdx/next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default withSentryConfig(withMDX(nextConfig), {
  org: process.env.SENTRY_ORG || "ajay-w6",
  project: process.env.SENTRY_PROJECT || "ziyarn",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  silent: !process.env.CI,
});
