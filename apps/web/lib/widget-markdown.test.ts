import { describe, expect, it } from "vitest";

import {
  parseWidgetMarkdown,
  type InlineNode,
  type MarkdownBlock,
} from "@/lib/widget-markdown";

/** Flattens inline nodes to their visible text, for compact assertions. */
function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "text" || node.kind === "code") return node.value;
      if (node.kind === "break") return "\n";
      return inlineText(node.children);
    })
    .join("");
}

function onlyBlock(blocks: MarkdownBlock[]): MarkdownBlock {
  expect(blocks).toHaveLength(1);
  const [block] = blocks;
  if (!block) throw new Error("expected one block");
  return block;
}

describe("parseWidgetMarkdown", () => {
  it("renders plain paragraphs and hard line breaks", () => {
    const blocks = parseWidgetMarkdown("Line one\nLine two");
    const paragraph = onlyBlock(blocks);
    expect(paragraph.kind).toBe("paragraph");
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(paragraph.children).toContainEqual({ kind: "break" });
    expect(inlineText(paragraph.children)).toBe("Line one\nLine two");
  });

  it("renders bullet lists with inline emphasis inside items", () => {
    const blocks = parseWidgetMarkdown(
      "Top picks:\n- **Alpha** jersey\n- Beta jersey",
    );
    expect(blocks).toHaveLength(2);

    const list = blocks[1];
    if (!list || list.kind !== "list") throw new Error("expected a list block");
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(list.items[0]?.[0]).toMatchObject({ kind: "strong" });
    expect(inlineText(list.items[0] ?? [])).toBe("Alpha jersey");
    expect(inlineText(list.items[1] ?? [])).toBe("Beta jersey");
  });

  it("renders numbered lists and keeps the starting number", () => {
    const blocks = parseWidgetMarkdown("3. third\n4. fourth");
    const list = onlyBlock(blocks);
    expect(list.kind).toBe("list");
    if (list.kind !== "list") throw new Error("unreachable");
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(3);
    expect(list.items.map(inlineText)).toEqual(["third", "fourth"]);
  });

  it("does not mistake a bold line for a bullet", () => {
    const blocks = parseWidgetMarkdown("**Bold start** of the reply");
    const paragraph = onlyBlock(blocks);
    expect(paragraph.kind).toBe("paragraph");
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(paragraph.children[0]).toMatchObject({ kind: "strong" });
  });

  it("renders headings", () => {
    const blocks = parseWidgetMarkdown("### Top picks");
    const heading = onlyBlock(blocks);
    expect(heading.kind).toBe("heading");
    if (heading.kind !== "heading") throw new Error("unreachable");
    expect(inlineText(heading.children)).toBe("Top picks");
  });

  it("keeps fenced code literal, including markdown markers", () => {
    const blocks = parseWidgetMarkdown("```\n- not a list\n**not bold**\n```");
    const code = onlyBlock(blocks);
    expect(code.kind).toBe("code");
    if (code.kind !== "code") throw new Error("unreachable");
    expect(code.value).toBe("- not a list\n**not bold**");
  });

  it("renders inline code without touching identifiers", () => {
    const blocks = parseWidgetMarkdown("Use `product_name` and SALE_PRICE");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(paragraph.children).toContainEqual({
      kind: "code",
      value: "product_name",
    });
    expect(inlineText(paragraph.children)).toBe("Use product_name and SALE_PRICE");
    expect(paragraph.children.some((node) => node.kind === "em")).toBe(false);
  });

  it("renders underscore emphasis only at word boundaries", () => {
    const blocks = parseWidgetMarkdown("_really_ nice");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(paragraph.children[0]).toMatchObject({ kind: "em" });
  });

  it("renders markdown links and rejects unsafe schemes", () => {
    const safe = parseWidgetMarkdown("[Shop](https://urbanplusgh.com/products/x)");
    const paragraph = onlyBlock(safe);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(paragraph.children[0]).toMatchObject({
      kind: "link",
      href: "https://urbanplusgh.com/products/x",
    });

    const unsafe = parseWidgetMarkdown("[x](javascript:alert(1))");
    const unsafeParagraph = onlyBlock(unsafe);
    if (unsafeParagraph.kind !== "paragraph") throw new Error("unreachable");
    expect(unsafeParagraph.children.every((node) => node.kind === "text")).toBe(
      true,
    );
    expect(inlineText(unsafeParagraph.children)).toBe("[x](javascript:alert(1))");
  });

  it("autolinks bare URLs and trims sentence punctuation", () => {
    const blocks = parseWidgetMarkdown("Track it at https://example.com/track?order=1.");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    const link = paragraph.children.find((node) => node.kind === "link");
    expect(link).toMatchObject({
      kind: "link",
      href: "https://example.com/track?order=1",
    });
  });

  it("renders strikethrough", () => {
    const blocks = parseWidgetMarkdown("~~old~~ new");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(paragraph.children[0]).toMatchObject({ kind: "del" });
  });

  it("spaces em and en dashes like the widget always has", () => {
    const blocks = parseWidgetMarkdown("fast—reliable, 5–10 items");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(inlineText(paragraph.children)).toBe(
      "fast — reliable, 5 - 10 items",
    );
  });

  it("leaves partial streaming syntax literal instead of throwing", () => {
    const blocks = parseWidgetMarkdown("Here is **bold");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(inlineText(paragraph.children)).toBe("Here is **bold");
  });

  it("never emits HTML from model text — it stays literal content", () => {
    const blocks = parseWidgetMarkdown("<script>alert(1)</script>");
    const paragraph = onlyBlock(blocks);
    if (paragraph.kind !== "paragraph") throw new Error("unreachable");
    expect(inlineText(paragraph.children)).toBe("<script>alert(1)</script>");
  });

  it("keeps blank lines as block separators", () => {
    const blocks = parseWidgetMarkdown("First.\n\nSecond.");
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "paragraph",
    ]);
  });
});
