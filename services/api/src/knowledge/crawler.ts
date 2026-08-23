import {
  MAX_DOCUMENT_CHARS,
  MAX_CRAWL_PAGES,
  MAX_CRAWL_DEPTH,
} from "@repo/api/knowledge/schemas";
import { extractHtmlText, extractHtmlTitle } from "@repo/api/knowledge/extract";

/** Per-page fetch timeout in milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;

/** Delay between page fetches so we do not hammer the target server. */
const FETCH_DELAY_MS = 300;

/** Path fragments that never contain useful public content. */
const SKIP_PATTERNS = [
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
