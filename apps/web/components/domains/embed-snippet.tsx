"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Check, Copy, Terminal } from "lucide-react";

import { CopyLinkButton } from "@/components/team/copy-link-button";
import { APP_ROUTES } from "@/constants/routes";

/**
 * The install snippet for a domain.
 *
 * Every variant uses the same `<script>` + `<zy-widget>` tag. The widget
 * fetches its variant from the server on every page load, so owners can switch
 * between Classic, Glow, and Modern Sleek in the dashboard and the change
 * takes effect on all live sites immediately — no snippet update required.
 *
 * Classic and Glow render inside the element's shadow root; Modern Sleek's
 * script opens its full-screen iframe overlay.
 *
 * The card also gives the owner a copyable dashboard link for their CMS admin
 * menu or bookmarks.
 */
export function EmbedSnippet({
  domainId,
  widgetUrl,
  slug,
  secret,
  variant,
}: {
  domainId: string;
  widgetUrl: string;
  slug: string;
  secret: string;
  /** Used only for the descriptive note below the snippet; not emitted into the embed tag. */
  variant?: string;
}) {
  const [copied, setCopied] = useState(false);
  const isSleek = variant === "sleek";
  const embedOrigin = (() => {
    try {
      return new URL(widgetUrl).origin;
    } catch {
      return "https://ziyarn.vercel.app";
    }
  })();
  const dashboardUrl = `${embedOrigin}${APP_ROUTES.DASHBOARD_DOMAINS}?domainId=${encodeURIComponent(domainId)}`;

  // data-variant is intentionally omitted: the widget fetches the active
  // variant from the server on every load, so changing the widget style in
  // the dashboard takes effect on live sites without a snippet update.
  const snippet = [
    `<script defer src="${widgetUrl}"></script>`,
    `<zy-widget`,
    `  data-slug="${slug}"`,
    `  data-secret="${secret}"`,
    `  data-title="Chat with us"`,
    `></zy-widget>`,
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embed the widget</CardTitle>
        <CardDescription>
          Paste this snippet into any page on your website. The widget style is
          controlled from the dashboard — no snippet update needed when you
          switch variants.
          {isSleek
            ? ` If your site sets a CSP, allow frame-src ${embedOrigin}.`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative rounded-lg border bg-muted/40">
          <pre className="max-h-80 overflow-auto p-3 pr-12 font-mono text-xs leading-relaxed">
            <code>{snippet}</code>
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="absolute right-2 top-2"
            onClick={copy}
            aria-label="Copy embed snippet"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Terminal size={12} />
          Customize colors with data-color, position with data-position.
        </p>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Keep Ziyarn in your site admin</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste this link into your CMS menu or bookmark it. It opens this
            domain&apos;s dashboard.
          </p>
          <div className="mt-2 flex items-start gap-2">
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="min-w-0 flex-1 font-mono text-xs break-all text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {dashboardUrl}
            </a>
            <CopyLinkButton url={dashboardUrl} label="dashboard link" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
