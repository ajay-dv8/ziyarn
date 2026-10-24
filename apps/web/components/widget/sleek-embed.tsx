"use client";

import { useCallback, useEffect, useState } from "react";

import { ChatWidget } from "@/components/widget/chat-widget";

/**
 * The framed surface. `/embed/[slug]` renders this page; the widget script
 * shows the iframe only after its launcher is clicked, and hides it again when
 * the chat posts `ziyarn:close`.
 *
 * The page paints no background of its own: the script's overlay is the frosted
 * glass over the host page, and the iframe must stay transparent for that page
 * to show through — hence the body override below.
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
    <>
      {/* Core globals paint <body> opaque (bg-background); an opaque iframe
          document would hide the host page the glass overlay frosts. */}
      <style>{"html,body{background:transparent}"}</style>
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
        <ChatWidget
          className="relative z-10"
          mode="embed"
          slug={slug}
          secret={secret}
          enforcePlan={enforcePlan}
          onClose={embedded ? close : undefined}
        />
      </main>
    </>
  );
}
