import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import {
  MAX_DOCUMENT_CHARS,
  MAX_CRAWL_PAGES,
  MAX_CRAWL_DEPTH,
} from "@repo/api/knowledge/schemas";
import { extractHtmlText, extractHtmlTitle } from "@repo/api/knowledge/extract";
import { PRIVATE_PAGE_PATTERNS } from "@repo/api/knowledge/source-links";

/** Per-page fetch timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;

/** Delay between page fetches so we do not hammer the target server. */
const FETCH_DELAY_MS = 300;

/** Path fragments that never contain useful public content. */
const SKIP_PATTERNS = [
  ...PRIVATE_PAGE_PATTERNS,
  "/api/",
  "/cdn-cgi/",
  "mailto:",
  "tel:",
  "javascript:",
];

/** File extensions that are downloads, not pages. */
const SKIP_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".css",
  ".js",
  ".json",
  ".xml",
  ".rss",
  ".pdf",
  ".zip",
  ".gz",
  ".rar",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
];

export type CrawledPage = {
  url: string;
  title: string | null;
  text: string;
};

export type CrawlResult = {
  pagesFound: number;
  pagesCrawled: number;
  errors: string[];
};

export type CrawlDeps = {
  /** Fetches a URL and returns its HTML, or null when unreachable/non-HTML. */
  fetchPage: (url: string) => Promise<string | null>;
  /**
   * Persists one crawled page. Errors thrown here are recorded per page and
   * the crawl continues — the whole run only aborts on shouldStop.
   */
  onPage: (page: CrawledPage) => Promise<void>;
  /** Returns true when the crawl should stop early (job cancelled/shutdown). */
  shouldStop?: () => boolean;
};

export type CrawlConfig = {
  startUrl: string;
  maxPages?: number;
  maxDepth?: number;
};

/** Strips hash + trailing slash and normalizes host casing for dedup. */
function normalizeUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.protocol}//${url.host}${path}${url.search}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSkippable(url: string): boolean {
  const lower = url.toLowerCase();
  const pathOnly = lower.split("?")[0] ?? "";
  if (SKIP_PATTERNS.some((pattern) => pathOnly.includes(pattern))) return true;
  if (SKIP_EXTENSIONS.some((ext) => pathOnly.endsWith(ext))) return true;
  return false;
}

/** IPv4 literal address is private or reserved (RFC 1918, loopback, link-local, multicast, …). */
function ipv4IsPrivateOrReserved(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const a = nums[0]!;
  const b = nums[1]!;
  const c = nums[2]!;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24, 192.0.2.0/24
  if (a === 192 && b === 88 && c === 99) return true; // 192.88.99.0/24 (6to4 relay)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24
  if (a >= 224) return true; // 224.0.0.0/4 multicast + reserved
  return false;
}

/** IPv6 literal address is private or reserved (loopback, unique-local, link-local, multicast, …). */
function ipv6IsPrivateOrReserved(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback
  if (lower.startsWith("::ffff:")) return true; // IPv4-mapped (embedded IPv4 may be private)
  if (lower.startsWith("64:ff9b:")) return true; // IPv4/IPv6 translation
  if (lower.startsWith("100:")) return true; // 100::/64 discard
  if (lower.startsWith("2001:db8:")) return true; // documentation
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique-local
  if (
    lower.startsWith("fe80:") ||
    lower.startsWith("fe90:") ||
    lower.startsWith("fea0:") ||
    lower.startsWith("feb0:")
  )
    return true; // fe80::/10 link-local
  if (lower.startsWith("ff")) return true; // ff00::/8 multicast
  return false;
}

/**
 * Returns true when a hostname (literal IP or DNS-resolvable name) must not be
 * fetched because it resolves to a private or reserved address. DNS resolution
 * failure is treated as blocked so the crawler never silently reaches an
 * unintended host.
 */
export async function isBlockedHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "localhost.localdomain") return true;

  const family = isIP(hostname);
  if (family === 4) return ipv4IsPrivateOrReserved(hostname);
  if (family === 6) return ipv6IsPrivateOrReserved(hostname);

  // Hostname: resolve and check every returned address.
  try {
    const addresses = await lookup(hostname, { all: true });
    for (const { address, family: addrFamily } of addresses) {
      if (addrFamily === 4 && ipv4IsPrivateOrReserved(address)) return true;
      if (addrFamily === 6 && ipv6IsPrivateOrReserved(address)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

const HREF_RE = /<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["']/gi;

/** Extracts internal links from an HTML document. */
function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(HREF_RE)) {
    const href = match[1]?.trim();
    if (!href) continue;
    const resolved = normalizeUrl(
      new URL(href, baseUrl).toString(),
    );
    if (resolved) links.push(resolved);
  }
  return links;
}

/**
 * Breadth-first website crawler with sensible limits (max pages, max depth,
 * same-host only, skip non-content paths). Calls deps.onPage for each
 * successfully fetched page and returns a summary.
 */
export async function crawlWebsite(
  deps: CrawlDeps,
  config: CrawlConfig,
): Promise<CrawlResult> {
  const startUrl = normalizeUrl(config.startUrl);
  if (!startUrl) {
    throw new Error("Invalid or unsupported start URL");
  }

  const maxPages = config.maxPages ?? MAX_CRAWL_PAGES;
  const maxDepth = config.maxDepth ?? MAX_CRAWL_DEPTH;
  const startHost = hostOf(startUrl);

  const queue: Array<{ url: string; depth: number }> = [
    { url: startUrl, depth: 0 },
  ];
  const visited = new Set<string>([startUrl]);
  let pagesFound = 1;
  let pagesCrawled = 0;
  const errors: string[] = [];

  while (queue.length > 0 && pagesCrawled < maxPages) {
    if (deps.shouldStop?.()) break;

    const next = queue.shift();
    if (!next) break;
    const { url, depth } = next;

    let html: string | null = null;
    try {
      // SSRF guard: never fetch a literal private/resolved IP address.
      const urlObj = new URL(url);
      const hostnameFamily = isIP(urlObj.hostname);
      if (
        (hostnameFamily === 4 || hostnameFamily === 6) &&
        (await isBlockedHost(urlObj.hostname))
      ) {
        errors.push(`${url}: blocked private or reserved host`);
        continue;
      }
      html = await deps.fetchPage(url);
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }

    if (html !== null) {
      const text = extractHtmlText(html).slice(0, MAX_DOCUMENT_CHARS);
      if (text.length > 0) {
        try {
          await deps.onPage({ url, title: extractHtmlTitle(html), text });
          pagesCrawled += 1;
        } catch (error) {
          errors.push(
            `${url}: ${error instanceof Error ? error.message : "ingest failed"}`,
          );
        }
      }

      if (depth < maxDepth) {
        for (const link of extractLinks(html, url)) {
          if (visited.has(link)) continue;
          visited.add(link);
          if (hostOf(link) !== startHost) continue;
          if (isSkippable(link)) continue;
          if (pagesFound >= maxPages * 10) break;
          pagesFound += 1;
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }

    if (queue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
    }
  }

  return { pagesFound, pagesCrawled, errors };
}

/** Default fetchPage implementation using global fetch. */
export function createDefaultFetchPage(): (url: string) => Promise<string | null> {
  return async (url) => {
    const parsed = new URL(url);
    if (await isBlockedHost(parsed.hostname)) {
      throw new Error(`SSRF: private or resolved-to-private host blocked: ${parsed.hostname}`);
    }
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent": "ZiyarnBot/1.0 (+https://ziyarn.com/bot)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }
    return response.text();
  };
}
