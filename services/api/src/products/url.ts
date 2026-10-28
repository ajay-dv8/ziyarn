import { isPrivatePageUrl } from "@repo/api/knowledge/source-links";

/**
 * Product page URLs are absolute http(s) destinations. Relative paths and bare
 * slugs are rejected rather than guessed; Convex storage URLs are image assets,
 * not product pages, and account/private routes are not visitor destinations.
 */
export function isProductPageUrl(value: string): boolean {
  if (value.length > 2_000) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (isPrivatePageUrl(value)) return false;
  const path = url.pathname.toLowerCase();
  if (path === "/api/storage" || path.startsWith("/api/storage/")) return false;
  return true;
}
