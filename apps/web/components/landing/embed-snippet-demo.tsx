"use client";

import { useEffect, useRef, useState } from "react";

import { Globe } from "lucide-react";

import { CodeBlock } from "@/components/common/code-block";

/**
 * The snippet a Ziyarn customer pastes before `</body>` — same shape the
 * dashboard's embed-snippet hands real owners. Marketing values only: the
 * landing never shows a live slug or key.
 */
const FULL_SNIPPET = [
  "<!-- Ziyarn chat widget -->",
  '<script defer src="https://ziyarn.vercel.app/widget.js"></script>',
  "",
  "<zy-widget",
  '  data-slug="your-business"',
  '  data-secret="your-embed-key"',
  '  data-title="Chat with us"',
  "></zy-widget>",
].join("\n");

/** Milliseconds per typing tick; each tick reveals TICK_CHARS more characters. */
const TICK_MS = 24;
const TICK_CHARS = 3;

/**
 * Step 3's IDE/browser mockup: the embed snippet types itself out the first
 * time the card scrolls into view. Full code renders on the server and stays
 * there for reduced-motion users, so no-JS visitors still see the snippet.
 */
export function EmbedSnippetDemo({ className }: { className?: string }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [typedCount, setTypedCount] = useState(FULL_SNIPPET.length);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setTypedCount(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setStarted(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const intervalId = window.setInterval(() => {
      setTypedCount((count) => {
        if (count >= FULL_SNIPPET.length) {
          window.clearInterval(intervalId);
          return count;
        }
        return Math.min(count + TICK_CHARS, FULL_SNIPPET.length);
      });
    }, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [started]);

  return (
    <div
      ref={cardRef}
      className={
        className ??
        "aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-[0_24px_60px_-24px_rgba(8,6,18,0.45)]"
      }
    >
      {/* Browser chrome: traffic lights + address bar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#181c24] px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-white/5 px-3 py-1 font-sans text-xs text-zinc-400">
          <Globe className="size-3 shrink-0" strokeWidth={2} />
          <span className="truncate">https://yourbusiness.com</span>
        </span>
      </div>

      <CodeBlock
        language="html"
        filename="index.html"
        code={started ? FULL_SNIPPET.slice(0, typedCount) : FULL_SNIPPET}
      />
    </div>
  );
}
