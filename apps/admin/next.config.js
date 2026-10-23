import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// See apps/web/next.config.js for the full rationale. Better-auth talks to this
// app's own /api/auth and all data goes through its own server code, except for
// the Cloudinary Upload Widget: it loads/frames upload-widget.cloudinary.com and
// uploads to api.cloudinary.com.
const connectSources = [
  "'self'",
  originOf(process.env.NEXT_PUBLIC_ADMIN_BETTER_AUTH_URL),
  "https://api.cloudinary.com",
  "https://upload-widget.cloudinary.com",
].filter(Boolean);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' https://upload-widget.cloudinary.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' https://upload-widget.cloudinary.com",
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
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  serverExternalPackages: ["@neondatabase/serverless"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
