"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Check, Copy } from "lucide-react";

/**
 * A secret shown in monospace with a one-click copy button.
 *
 * The embed secret is long, has no line breaks, and is usually needed in a
 * terminal or an HTML file rather than read by eye — so copying beats
 * highlighting by hand. The value itself stays visible (it is not a password
 * box with a reveal toggle: it is already on screen by the time you see this)
 * and the button confirms the copy the same way the embed-snippet copy button
 * does.
 */
export function CopySecretField({
  value,
  label,
}: {
  value: string;
  /** Names the value for screen readers, e.g. "Embed secret". */
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending "Copied" reset if the button is clicked again, and on
  // unmount, so a stale timer cannot flip state after this is gone.
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the value is still visible to copy by hand */
    }
  };

  return (
    <div className="mt-1 flex items-start gap-2">
      <p className="min-w-0 flex-1 font-mono text-sm break-all">{value}</p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
        className="shrink-0"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
