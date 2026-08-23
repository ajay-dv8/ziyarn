"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Globe, Loader2 } from "lucide-react";

type CrawlJob = {
  id: string;
  url: string;
  status: "pending" | "running" | "completed" | "failed";
  pagesFound: number;
  pagesCrawled: number;
  error: string | null;
};

export function WebsiteCrawlForm({
  domainId,
  agentId,
}: {
  domainId: string;
  agentId: string;
}) {
  const [url, setUrl] = useState("");
  const [job, setJob] = useState<CrawlJob | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshedRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  const router = useRouter();

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/knowledge/crawl?domainId=${domainId}&agentId=${agentId}`,
      );
      if (!res.ok) return;
      const status = (await res.json()) as {
        job: CrawlJob | null;
        documentCount: number;
      };
      setJob(status.job);
      setDocumentCount(status.documentCount);
      setLoaded(true);

      const currentStatus = status.job?.status ?? null;
      const wasActive =
        prevStatusRef.current === "pending" || prevStatusRef.current === "running";

      if (
        currentStatus &&
        (currentStatus === "pending" || currentStatus === "running")
      ) {
        if (!pollRef.current) {
          pollRef.current = setInterval(() => void refresh(), 2000);
        }
      } else {
        stopPolling();
        // Only refresh the page list when we observed the finish in this
        // session — never on initial load, or we would loop forever.
        if (currentStatus === "completed" && wasActive && !refreshedRef.current) {
          refreshedRef.current = true;
          router.refresh();
        }
      }
      prevStatusRef.current = currentStatus;
    } catch {
      // transient network error — keep polling
    }
  }, [domainId, agentId, stopPolling, router]);

  useEffect(() => {
    void refresh();
    return stopPolling;
  }, [refresh, stopPolling]);

  async function startCrawl() {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

    setStarting(true);
    setError(null);
    refreshedRef.current = false;
    try {
      const res = await fetch("/api/knowledge/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domainId, agentId, url: target }),
      });
      const body = (await res.json().catch(() => null)) as {
        crawlJob?: CrawlJob;
        error?: { message?: string };
      } | null;
      if (!res.ok || !body?.crawlJob) {
        setError(body?.error?.message ?? "We could not start the crawl.");
        return;
      }
      setJob(body.crawlJob);
      if (!pollRef.current) {
        pollRef.current = setInterval(() => void refresh(), 2000);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  const busy =
    starting || job?.status === "pending" || job?.status === "running";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="crawl-url">Crawl your website</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        We follow links from your site (up to 50 pages, 3 levels deep) and add
        each page to the knowledge base so your agent can answer from your
        website content. Starting a new crawl replaces previous crawl results.
      </p>

      <div className="flex gap-2">
        <Input
          id="crawl-url"
          type="url"
          placeholder="https://yourwebsite.com"
          value={url}
          disabled={busy}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void startCrawl();
          }}
          className="max-w-sm"
        />
        <Button onClick={startCrawl} disabled={busy || !url.trim()} size="sm">
          {busy ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Crawling…
            </>
          ) : job ? (
            "Re-crawl site"
          ) : (
            "Start crawl"
          )}
        </Button>
      </div>

      {busy && job ? (
        <p className="text-sm text-muted-foreground" role="status">
          Visiting pages of {job.url}… ({job.pagesCrawled}
          {job.pagesFound > 0 ? ` of ~${job.pagesFound}` : ""} pages added so
          far)
        </p>
      ) : null}

      {!busy && loaded && job?.status === "completed" ? (
        <p className="text-sm text-emerald-600" role="status">
          Last crawl of {job.url} added {documentCount} page(s) to the knowledge
          base.
        </p>
      ) : null}

      {!busy && job?.status === "failed" ? (
        <p className="text-sm text-red-600" role="alert">
          Last crawl failed{job.error ? `: ${job.error}` : "."}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
