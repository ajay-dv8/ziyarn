"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Check, Copy } from "lucide-react";

/**
 * Copies an invite link. The link is the fallback when SMTP is not configured
 * on the deployment, so it has to be reachable without leaving the page.
 */
export function CopyLinkButton({
  url,
  label,
}: {
  url: string;
  /** What is being copied, e.g. "invite link for sam@acme.com". */
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, denied permission): leave the URL
      // visible next to the button so it can still be selected by hand.
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={copy}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
      className="shrink-0"
    >
      {copied ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
