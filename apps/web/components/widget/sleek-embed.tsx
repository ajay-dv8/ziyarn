"use client";

import { useCallback, useEffect, useState } from "react";

import { ChatWidget } from "@/components/widget/chat-widget";

/**
 * The framed surface. `/embed/[slug]` renders this page; the widget script
 * shows the iframe only after its launcher is clicked, and hides it again when
 * the chat posts `ziyarn:close`.
 *
 * The page paints no background of its own: the script's overlay is a light
 * frosted glass veil, and the iframe must stay transparent for the frosted
 * host page to show through — hence the body override below.
 *
 * The root layout's next-themes provider resolves the owner's OS theme and
 * adds class="dark" to every page it wraps, including this one. `.dark` sets
 * `color-scheme: dark`, and a transparent iframe document under a dark color
 * scheme gets the UA's OPAQUE dark canvas — the whole frame renders as a
 * solid black slab instead of showing the host page. Forcing light here pins
 * the iframe canvas to transparency on any device theme.
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

  // Mirror the mobile keyboard into CSS variables. iOS (and Chrome for
  // Android) overlay the keyboard without shrinking the layout viewport, so
  // dvh-based sizes keep their full-screen value and the browser pans the
  // page — sliding the chat's header off the top edge exactly when the
  // visitor starts typing. window.visualViewport describes the actually
  // visible area; the mobile media block in the style tag below anchors the
  // surface (and, via the panel's height utility, the chat itself) to it.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const apply = () => {
      const documentRoot = document.documentElement;
      // iOS reports negative offsets while the keyboard's pan settles.
      documentRoot.style.setProperty("--zy-vvh", `${viewport.height}px`);
      documentRoot.style.setProperty(
        "--zy-vv-top",
        `${Math.max(0, viewport.offsetTop)}px`,
      );
    };
    apply();
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      document.documentElement.style.removeProperty("--zy-vvh");
      document.documentElement.style.removeProperty("--zy-vv-top");
    };
  }, []);

  const close = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "ziyarn:close" }, "*");
    }
  }, []);

  return (
    <>
      {/* Core globals paint <body> opaque (bg-background); an opaque iframe
          document would hide the host page the glass veil frosts. The
          color-scheme pin defeats the canvas rule that .dark (set by
          next-themes on dark-OS devices) would otherwise impose. */}
      <style>
        {"html,body{background:transparent}:root{color-scheme:light !important}"}
      </style>
      <main className="relative flex flex-col min-h-dvh items-baseline justify-end overflow-hidden px-4 py-8">
        <ChatWidget
          className="relative z-10"
          mode="embed"
          slug={slug}
          secret={secret}
          enforcePlan={enforcePlan}
          onClose={embedded ? close : undefined}
        />
        <p className="self-center mt-1 text-xs text-gray-500 max-[480px]:hidden">
          Powered by Ziyarn
        </p>
      </main>
    </>
  );
}
