"use client";

import { useEffect, useRef } from "react";

import type Quill from "quill";
import "quill/dist/quill.snow.css";

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ list: "ordered" }, { list: "bullet" }],
  ["link"],
  ["clean"],
];

/**
 * Rich-text editor on Quill (snow theme). Uncontrolled after mount — pass
 * `initialValue` for pre-filled content and read changes via `onChange`.
 */
export function RichTextEditor({
  initialValue = "",
  placeholder,
  onChange,
  className,
}: {
  initialValue?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { default: QuillClass } = await import("quill");
      if (cancelled || !containerRef.current || quillRef.current) return;

      const quill = new QuillClass(containerRef.current, {
        theme: "snow",
        placeholder,
        modules: { toolbar: TOOLBAR },
      });
      quillRef.current = quill;

      if (initialValue) {
        quill.clipboard.dangerouslyPasteHTML(initialValue);
      }

      quill.on("text-change", () => {
        onChangeRef.current?.(quill.getSemanticHTML());
      });
    })();

    return () => {
      cancelled = true;
    };
    // Runs once per mount; initialValue is only read at editor creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quill owns this node's children; React never reconciles them.
  return (
    <div className={className} suppressHydrationWarning>
      <div ref={containerRef} />
    </div>
  );
}
