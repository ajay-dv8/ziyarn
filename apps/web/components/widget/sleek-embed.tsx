"use client";

import { useCallback, useEffect, useState } from "react";

import { ChatWidget } from "@/components/widget/chat-widget";
import { WidgetBackdrop } from "@/components/widget/widget-backdrop";

/**
 * The framed surface. `/embed/[slug]` renders this page; the widget script
 * shows the iframe only after its launcher is clicked, and hides it again when
 * the chat posts `ziyarn:close`.
 *
 * The close button is deliberately absent when the page is opened directly:
 * there is no host page to return to.
 */
export function SleekEmbed({ slug, secret }: { slug: string; secret: string }) {
  const [embedded, setEmbedded] = useState(false);

  // Production keeps the plan gate. Development skips it so the surface can be
  // exercised against any scratch domain without rewriting that domain's saved
  // widget style (the dashboard preview does the same in `preview` mode).
  const enforcePlan = process.env.NODE_ENV === "production";

  useEffect(() => {
    const isEmbedded = window.parent !== window;
    setEmbedded(isEmbedded);
    if (isEmbedded) window.parent.postMessage({ type: "ziyarn:ready" }, "*");
  }, []);

  const close = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "ziyarn:close" }, "*");
    }
  }, []);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#1b1a1f] px-4 py-8">
      <WidgetBackdrop />
      <ChatWidget
        className="relative z-10"
        mode="embed"
        slug={slug}
        secret={secret}
        enforcePlan={enforcePlan}
        onClose={embedded ? close : undefined}
      />
    </main>
  );
}
