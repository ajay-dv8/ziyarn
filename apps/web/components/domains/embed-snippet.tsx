"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Check, Copy, Terminal } from "lucide-react";

export function EmbedSnippet({
  widgetUrl,
  slug,
  secret,
}: {
  widgetUrl: string;
  slug: string;
  secret: string;
}) {
  const [copied, setCopied] = useState(false);

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
          Paste this snippet into any page on your website. Works in browsers
          and mobile apps — no iframe required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative rounded-lg border bg-muted/40">
          <pre className="overflow-x-auto p-3 pr-12 font-mono text-xs leading-relaxed">
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
      </CardContent>
    </Card>
  );
}
