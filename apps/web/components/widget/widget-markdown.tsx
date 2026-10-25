"use client";

import { Fragment, type ReactNode } from "react";

import { cn } from "@repo/ui/lib/utils";
import {
  parseWidgetMarkdown,
  type InlineNode,
  type MarkdownBlock,
} from "@/lib/widget-markdown";

/**
 * Renders agent markdown for the Modern Sleek surface and the dashboard
 * preview. The subset and its parsing live in `@/lib/widget-markdown`; this
 * file only maps the parsed tree to the widget's type scale and palette.
 *
 * Styling notes: bubbles are 13px, so headings stay close to body size and
 * lists hang their markers outside the text column (pl-4) to keep line starts
 * aligned. All colours come from the established sleek world.
 */
export function WidgetMarkdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseWidgetMarkdown(text);

  return (
    <div
      className={cn(
        "zy-md space-y-1.5 text-[13px] leading-[1.55] text-[#1a1920] [overflow-wrap:anywhere]",
        className,
      )}
    >
      {blocks.map((block, index) => (
        <MarkdownBlockView key={index} block={block} />
      ))}
    </div>
  );
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }): ReactNode {
  switch (block.kind) {
    case "paragraph":
      return (
        <p>
          <InlineNodes nodes={block.children} />
        </p>
      );

    case "heading":
      return (
        <p className="font-semibold text-[#17161b]">
          <InlineNodes nodes={block.children} />
        </p>
      );

    case "list":
      return block.ordered ? (
        <ol
          start={block.start}
          className="list-decimal space-y-0.5 pl-4 marker:text-[#8f8b97]"
        >
          {block.items.map((item, index) => (
            <li key={index} className="pl-0.5">
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4 marker:text-[#8f8b97]">
          {block.items.map((item, index) => (
            <li key={index} className="pl-0.5">
              <InlineNodes nodes={item} />
            </li>
          ))}
        </ul>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-[8px] border border-[#e6e2ee] bg-[#f6f4f9] px-2.5 py-2 font-mono text-[11.5px] leading-[1.5]">
          <code>{block.value}</code>
        </pre>
      );

    case "quote":
      return (
        <blockquote className="border-l-2 border-[#d9d5e2] pl-2.5 text-[#494652]">
          <InlineNodes nodes={block.children} />
        </blockquote>
      );

    case "rule":
      return <hr className="border-[#e6e2ee]" />;
  }
}

function InlineNodes({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.kind === "text") {
          return <Fragment key={index}>{node.value}</Fragment>;
        }
        if (node.kind === "break") return <br key={index} />;
        if (node.kind === "code") {
          return (
            <code
              key={index}
              className="rounded-[4px] bg-[#17161b]/[0.06] px-1 py-[1px] font-mono text-[11.5px]"
            >
              {node.value}
            </code>
          );
        }
        if (node.kind === "link") {
          return (
            <a
              key={index}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-[#17161b]/25 underline-offset-2 transition hover:decoration-[#17161b]/60"
            >
              <InlineNodes nodes={node.children} />
            </a>
          );
        }
        if (node.kind === "strong") {
          return (
            <strong key={index} className="font-semibold">
              <InlineNodes nodes={node.children} />
            </strong>
          );
        }
        if (node.kind === "del") {
          return (
            <del key={index} className="opacity-70">
              <InlineNodes nodes={node.children} />
            </del>
          );
        }
        return (
          <em key={index}>
            <InlineNodes nodes={node.children} />
          </em>
        );
      })}
    </>
  );
}
