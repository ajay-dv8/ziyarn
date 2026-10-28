/**
 * Visitor-facing page URLs from crawled knowledge. The crawler stores the page
 * URL in `knowledge_documents.file_name`; uploaded files reuse that column for
 * a file name, so callers must only accept values that parse as http(s).
 *
 * Private/account pages are filtered here as well as in the crawler. Older
 * crawls may still contain them until the next re-crawl; filtering at query
 * time keeps them out of answers in the meantime.
 */

/** Path fragments that are never useful visitor destinations. */
export const PRIVATE_PAGE_PATTERNS = [
  "/login",
  "/signin",
  "/sign-in",
  "/signup",
  "/sign-up",
  "/register",
  "/logout",
  "/admin",
  "/wp-admin",
  "/cart",
  "/basket",
  "/checkout",
  "/billing",
  "/account",
  "/profile",
  "/password",
  "/orders",
  "/order",
  "/my-orders",
  "/my-account",
  "/my/",
  "/purchases",
] as const;

function pathnameOf(rawUrl: string): string | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }
  return parsedUrl.pathname.toLowerCase();
}

/** True when a page URL points at an account/private/non-content route. */
export function isPrivatePageUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl) return false;
  const pathname = pathnameOf(rawUrl);
  if (!pathname) return false;

  return PRIVATE_PAGE_PATTERNS.some((pattern) => {
    if (pattern.endsWith("/")) return pathname.startsWith(pattern);
    return pathname === pattern || pathname.startsWith(`${pattern}/`);
  });
}

/**
 * Returns the absolute public URL for a crawled page, or null for uploaded
 * file names, invalid URLs, and private routes. Callers should only call this
 * for documents with a crawl job; a file literally named like a URL is not a
 * page.
 */
export function publicSourceUrl(
  fileName: string | null | undefined,
): string | null {
  if (!fileName) return null;
  const pathname = pathnameOf(fileName);
  if (!pathname) return null;
  if (isPrivatePageUrl(fileName)) return null;

  const parsedUrl = new URL(fileName);
  parsedUrl.hash = "";
  return parsedUrl.toString();
}
