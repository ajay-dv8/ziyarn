/**
 * Markdown for chat replies — a deliberately small subset.
 *
 * Agent replies arrive as light markdown (bold, lists, links). Rendering them
 * as plain text leaves `**` and `- ` visible in every bubble; pulling in a full
 * CommonMark parser + sanitizer would add weight to the embed page for syntax
 * the model never emits. This module owns the subset the React surface renders
 * (Modern Sleek + the dashboard preview); `apps/web/widget/helpers.js` mirrors
 * the same subset for the Shadow DOM variants (classic/glow), which cannot
 * import TypeScript.
 *
 * Supported:
 *   paragraphs, hard line breaks, bullet lists, numbered lists, headings,
 *   fenced code blocks, blockquotes, horizontal rules,
 *   **bold**, *italic*, _italic_, `code`, ~~strikethrough~~,
 *   [links](https://…), bare https:// links, em/en-dash spacing.
 *
 * Not supported: tables, images, nested lists, raw HTML (never emitted — the
 * renderers only build nodes/escaped strings from plain text).
 */

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "break" }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] }
  | { kind: "del"; children: InlineNode[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: InlineNode[] };

export type MarkdownBlock =
  | { kind: "paragraph"; children: InlineNode[] }
  | { kind: "heading"; children: InlineNode[] }
  | { kind: "list"; ordered: boolean; start: number; items: InlineNode[][] }
  | { kind: "code"; value: string }
  | { kind: "quote"; children: InlineNode[] }
  | { kind: "rule" };

/** Only these schemes become anchors; anything else stays literal text. */
export function isSafeLinkUrl(url: string): boolean {
  return /^(?:https?:\/\/|mailto:)/i.test(url);
}

/**
 * Turns agent markdown into blocks. Unknown syntax degrades to literal text —
 * streaming replies are parsed on every token, so partial markers (`**bold`
 * without its close) must render as typed, never throw or swallow the bubble.
 */
export function parseWidgetMarkdown(source: string): MarkdownBlock[] {
  const text = source
    .replace(/\r\n?/g, "\n")
    // The widget has always typeset em/en dashes with breathing room; keep the
    // behaviour consistent across surfaces. Tabs/spaces only — a leading `\s*`
    // would swallow line breaks around a dash at the end of a line.
    .replace(/[ \t]*\u2014[ \t]*/g, " \u2014 ")
    .replace(/[ \t]*\u2013[ \t]*/g, " - ");

  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    // Fenced code — everything inside is literal, including markdown markers.
    if (/^\s*```/.test(line)) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length) {
        const codeLine = lines[index] ?? "";
        if (/^\s*```\s*$/.test(codeLine)) break;
        codeLines.push(codeLine);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code", value: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*$/);
    if (heading) {
      blocks.push({ kind: "heading", children: parseInline(heading[1] ?? "") });
      index += 1;
      continue;
    }

    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    const bullet = line.match(/^\s{0,6}[-*+]\s+(.*)$/);
    if (bullet) {
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? "").match(/^\s{0,6}[-*+]\s+(.*)$/);
        if (!item) break;
        items.push(parseInline((item[1] ?? "").trim()));
        index += 1;
      }
      blocks.push({ kind: "list", ordered: false, start: 1, items });
      continue;
    }

    const numbered = line.match(/^\s{0,6}(\d{1,3})[.)]\s+(.*)$/);
    if (numbered) {
      const start = Number(numbered[1]) || 1;
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? "").match(/^\s{0,6}(\d{1,3})[.)]\s+(.*)$/);
        if (!item) break;
        items.push(parseInline((item[2] ?? "").trim()));
        index += 1;
      }
      blocks.push({ kind: "list", ordered: true, start, items });
      continue;
    }

    if (/^\s{0,3}>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoted = (lines[index] ?? "").match(/^\s{0,3}>\s?(.*)$/);
        if (!quoted) break;
        quoteLines.push(quoted[1] ?? "");
        index += 1;
      }
      blocks.push({ kind: "quote", children: parseInline(quoteLines.join("\n")) });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index] ?? "";
      if (paragraphLine.trim() === "" || isBlockStart(paragraphLine)) break;
      paragraph.push(paragraphLine);
      index += 1;
    }
    blocks.push({ kind: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    /^\s*```/.test(line) ||
    /^\s{0,3}#{1,6}\s+/.test(line) ||
    /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^\s{0,6}[-*+]\s+/.test(line) ||
    /^\s{0,6}\d{1,3}[.)]\s+/.test(line) ||
    /^\s{0,3}>\s?/.test(line)
  );
}

function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ kind: "text", value: buffer });
      buffer = "";
    }
  };

  while (index < source.length) {
    const character = source[index] ?? "";

    if (character === "\n") {
      flush();
      nodes.push({ kind: "break" });
      index += 1;
      continue;
    }

    if (character === "`") {
      const close = source.indexOf("`", index + 1);
      if (close !== -1) {
        flush();
        nodes.push({ kind: "code", value: source.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }

    if (source.startsWith("**", index)) {
      const close = source.indexOf("**", index + 2);
      if (close !== -1 && close > index + 2) {
        flush();
        nodes.push({
          kind: "strong",
          children: parseInline(source.slice(index + 2, close)),
        });
        index = close + 2;
        continue;
      }
    }

    if (source.startsWith("~~", index)) {
      const close = source.indexOf("~~", index + 2);
      if (close !== -1 && close > index + 2) {
        flush();
        nodes.push({
          kind: "del",
          children: parseInline(source.slice(index + 2, close)),
        });
        index = close + 2;
        continue;
      }
    }

    if (character === "*") {
      const close = source.indexOf("*", index + 1);
      if (close !== -1 && close > index + 1) {
        flush();
        nodes.push({
          kind: "em",
          children: parseInline(source.slice(index + 1, close)),
        });
        index = close + 1;
        continue;
      }
    }

    // Underscore emphasis only at word boundaries, so identifiers like
    // `product_name` or `SALE_PRICE` survive untouched.
    if (
      character === "_" &&
      (index === 0 || !/[A-Za-z0-9]/.test(source[index - 1] ?? ""))
    ) {
      const close = findUnderscoreClose(source, index + 1);
      if (close !== -1) {
        flush();
        nodes.push({
          kind: "em",
          children: parseInline(source.slice(index + 1, close)),
        });
        index = close + 1;
        continue;
      }
    }

    if (character === "[") {
      const match = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(source.slice(index));
      const href = match?.[2] ?? "";
      if (match && isSafeLinkUrl(href)) {
        flush();
        nodes.push({
          kind: "link",
          href,
          children: parseInline(match[1] ?? ""),
        });
        index += match[0].length;
        continue;
      }
    }

    // Bare URLs, only at a word boundary so `xhttps://…` stays text.
    if (
      (character === "h" || character === "H") &&
      (index === 0 || /[\s([<]/.test(source[index - 1] ?? "")) &&
      /^https?:\/\//i.test(source.slice(index))
    ) {
      const urlMatch = /^https?:\/\/[^\s<>"']+/i.exec(source.slice(index));
      if (urlMatch) {
        const url = trimTrailingPunctuation(urlMatch[0] ?? "");
        if (url.length > "https://".length) {
          flush();
          nodes.push({
            kind: "link",
            href: url,
            children: [{ kind: "text", value: url }],
          });
          index += url.length;
          continue;
        }
      }
    }

    buffer += character;
    index += 1;
  }

  flush();
  return nodes;
}

function findUnderscoreClose(source: string, from: number): number {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] !== "_") continue;
    const previous = source[index - 1] ?? "";
    const next = source[index + 1] ?? "";
    if (/\s/.test(previous)) continue;
    if (next && /[A-Za-z0-9]/.test(next)) continue;
    return index;
  }
  return -1;
}

/** Trims sentence punctuation a bare URL should not swallow (`.` `,` `)` …). */
function trimTrailingPunctuation(url: string): string {
  let trimmed = url.replace(/[.,;:!?]+$/, "");
  while (
    trimmed.endsWith(")") &&
    countCharacter(trimmed, ")") > countCharacter(trimmed, "(")
  ) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function countCharacter(value: string, character: string): number {
  let count = 0;
  for (const current of value) {
    if (current === character) count += 1;
  }
  return count;
}
