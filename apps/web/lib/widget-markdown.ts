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
 *   [links](https://…), bare https:// links, email/phone autolinks,
 *   tel:/mailto: links, em/en-dash spacing.
 *
 * Not supported: tables, images, nested lists, raw HTML (never emitted — the
 * renderers only build nodes/escaped strings from plain text).
 */

import type { MapLocation } from "@repo/api/domains/locations";

export type InlineNode =
  | { kind: "text"; value: string }
  | { kind: "break" }
  | { kind: "strong"; children: InlineNode[] }
  | { kind: "em"; children: InlineNode[] }
  | { kind: "del"; children: InlineNode[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; children: InlineNode[] };

/** The subset of a saved location the widget needs to build a map link. */
export type WidgetLocation = MapLocation & {
  id: string;
  notes?: string | null;
  isPrimary?: boolean;
};

export type MarkdownBlock =
  | { kind: "paragraph"; children: InlineNode[] }
  | { kind: "heading"; children: InlineNode[] }
  | { kind: "list"; ordered: boolean; start: number; items: InlineNode[][] }
  | { kind: "code"; value: string }
  | { kind: "quote"; children: InlineNode[] }
  | { kind: "rule" };

/** Only these schemes become anchors; anything else stays literal text. */
export function isSafeLinkUrl(url: string): boolean {
  return (
    /^(?:https?:\/\/|mailto:)/i.test(url) ||
    /^tel:\+?\d[\d().\s-]*$/i.test(url)
  );
}

/** Phone and email links should hand off to the device, not open a tab. */
export function isContactLink(href: string): boolean {
  return /^(?:mailto:|tel:)/i.test(href);
}

type ContactAutolink = { text: string; href: string };

const EMAIL_PATTERN =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/;
const PHONE_PATTERN = /^\(?\+?\(?\d[\d() .-]{5,}\d/;

function emailAutolinkAt(source: string, index: number): ContactAutolink | null {
  const previous = source[index - 1] ?? "";
  if (previous && /[A-Za-z0-9._%+-]/.test(previous)) return null;

  const match = EMAIL_PATTERN.exec(source.slice(index));
  if (!match) return null;
  const text = match[0];
  if (text.length > 254) return null;

  const next = source[index + text.length] ?? "";
  if (next && /[A-Za-z0-9_-]/.test(next)) return null;
  return { text, href: `mailto:${text}` };
}

/** Nearby wording separates a bare phone number from an order number. */
function hasPhoneContext(source: string, index: number): boolean {
  const before = source.slice(Math.max(0, index - 32), index);
  return /\b(?:call|phone|tel|telephone|mobile|cell|whatsapp|contact|dial|reach)\b[^\n]{0,24}$/i.test(
    before,
  );
}

function phoneAutolinkAt(source: string, index: number): ContactAutolink | null {
  const previous = source[index - 1] ?? "";
  if (/[0-9]/.test(previous)) return null;

  const match = PHONE_PATTERN.exec(source.slice(index));
  if (!match) return null;

  const text = match[0];
  if (text.length > 40) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;

  const next = source[index + text.length] ?? "";
  if (/[A-Za-z0-9_@#/$%-]/.test(previous)) return null;
  if (/[A-Za-z0-9_%-]/.test(next)) return null;

  const hasPlus = /^\(?\+/.test(text);
  if (
    /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}\s+\d{1,2}\s+\d{1,2}|\d{1,2}\s+\d{1,2}\s+\d{4})$/.test(
      text,
    ) ||
    /^\d{4}(?:\s*[-/.]\s*|\s+)\d{4}$/.test(text) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(text) ||
    /^\d{1,3}(?:[ .-]\d{3})+$/.test(text) ||
    /^\d+\.\d+$/.test(text)
  ) {
    return null;
  }
  if (countCharacter(text, "(") !== countCharacter(text, ")")) return null;

  if (!hasPlus && !/[()]/.test(text)) {
    const groups = text.split(/[ .-]+/);
    if (!groups.some((group) => group.length >= 3)) return null;
  }

  const hasFormatting = /[() .-]/.test(text);
  if (!hasPlus && !hasFormatting && !hasPhoneContext(source, index)) {
    return null;
  }

  return {
    text,
    href: `tel:${hasPlus ? "+" : ""}${digits}`,
  };
}

function contactAutolinkAt(
  source: string,
  index: number,
): ContactAutolink | null {
  const character = source[index] ?? "";
  if (/[A-Za-z0-9._%+-]/.test(character)) {
    const email = emailAutolinkAt(source, index);
    if (email) return email;
  }
  if (/[+(\d]/.test(character)) {
    return phoneAutolinkAt(source, index);
  }
  return null;
}

const LOCATION_MARKER_PREFIX = "[[location:";
const LOCATION_MARKER_MAX_LENGTH = 300;
const LOCATION_MARKER_PATTERN = /^\[\[location:\s*([^\]\n]*?)\s*\]\]/i;

type LocationMap = Map<string, WidgetLocation>;

/** Removes the widget-only marker for plain-text surfaces (e.g. dashboard). */
export function stripLocationMarkers(text: string): string {
  return text.replace(
    /\[\[location:\s*([^\]\n]*?)\s*\]\]/gi,
    (_marker, body: string) => {
      const trimmed = body.trim();
      const separator = trimmed.indexOf("|");
      if (separator !== -1) return trimmed.slice(separator + 1).trim();
      // A label-only marker is the old syntax; keep its text. An id-only
      // marker is new syntax and has no readable dashboard text.
      return /^loc_[A-Za-z0-9_-]+$/.test(trimmed) ? "location" : trimmed;
    },
  );
}

function mapsHref(place: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/**
 * Mirrors locationDirectionsUrl in @repo/api/domains/locations. Kept local so
 * the sleek embed does not pull the zod validation module into its bundle.
 */
function locationDirectionsUrl(
  location: WidgetLocation,
  platform: "ios" | "other",
): string {
  const latitude = location.latitude;
  const longitude = location.longitude;
  const hasCoordinates =
    typeof latitude === "number" && typeof longitude === "number";

  if (hasCoordinates && platform === "ios") {
    return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
  }

  if (hasCoordinates) {
    const params = new URLSearchParams({
      api: "1",
      destination: `${latitude},${longitude}`,
    });
    if (location.placeId) {
      params.set("destination_place_id", location.placeId);
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  if (location.placeId) {
    const params = new URLSearchParams({
      api: "1",
      destination: location.address || location.label,
      destination_place_id: location.placeId,
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  if (location.mapsUrl) return location.mapsUrl;

  return mapsHref(location.address || location.label);
}

function splitLocationMarker(body: string): {
  id: string;
  label: string;
  hasSeparator: boolean;
} {
  const separator = body.indexOf("|");
  if (separator === -1) {
    return { id: "", label: body.trim(), hasSeparator: false };
  }
  return {
    id: body.slice(0, separator).trim(),
    label: body.slice(separator + 1).trim(),
    hasSeparator: true,
  };
}

function detectedMapPlatform(): "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const userAgent = navigator.userAgent ?? "";
  if (/iPad|iPhone|iPod/.test(userAgent)) return "ios";
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
    ? "ios"
    : "other";
}

function locationMapFor(locations?: WidgetLocation[] | null): LocationMap {
  const map: LocationMap = new Map();
  for (const location of locations ?? []) {
    if (location && typeof location.id === "string") {
      map.set(location.id, location);
    }
  }
  return map;
}

/** The visible text while a marker is still arriving. */
function partialLocationText(body: string): string {
  const pipe = body.indexOf("|");
  if (pipe !== -1) return body.slice(pipe + 1).trim();
  const text = body.trim();
  // Hide the new id-only tag (`[[location: loc_…`) until it closes; the id
  // is not visitor-facing. Old label-only tags keep streaming their text.
  return text.startsWith("loc_") || "loc_".startsWith(text) ? "" : text;
}

/**
 * Turns agent markdown into blocks. Unknown syntax degrades to literal text —
 * streaming replies are parsed on every token, so partial markers (`**bold`
 * without its close) must render as typed, never throw or swallow the bubble.
 */
export function parseWidgetMarkdown(
  source: string,
  locations?: WidgetLocation[] | null,
): MarkdownBlock[] {
  const locationMap = locationMapFor(locations);
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
      blocks.push({
        kind: "heading",
        children: parseInline(heading[1] ?? "", locationMap),
      });
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
        items.push(parseInline((item[1] ?? "").trim(), locationMap));
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
        items.push(parseInline((item[2] ?? "").trim(), locationMap));
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
      blocks.push({
        kind: "quote",
        children: parseInline(quoteLines.join("\n"), locationMap),
      });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index] ?? "";
      if (paragraphLine.trim() === "" || isBlockStart(paragraphLine)) break;
      paragraph.push(paragraphLine);
      index += 1;
    }
    blocks.push({
      kind: "paragraph",
      children: parseInline(paragraph.join("\n"), locationMap),
    });
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

function parseInline(
  source: string,
  locationMap: LocationMap,
  allowAutolinks = true,
): InlineNode[] {
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
          children: parseInline(
            source.slice(index + 2, close),
            locationMap,
            allowAutolinks,
          ),
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
          children: parseInline(
            source.slice(index + 2, close),
            locationMap,
            allowAutolinks,
          ),
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
          children: parseInline(
            source.slice(index + 1, close),
            locationMap,
            allowAutolinks,
          ),
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
          children: parseInline(
            source.slice(index + 1, close),
            locationMap,
            allowAutolinks,
          ),
        });
        index = close + 1;
        continue;
      }
    }

    if (character === "[") {
      const locationMarker = LOCATION_MARKER_PATTERN.exec(source.slice(index));
      if (locationMarker) {
        flush();
        const markerBody = (locationMarker[1] ?? "").trim();
        const { id, label, hasSeparator } = splitLocationMarker(markerBody);
        const location = id ? locationMap.get(id) : undefined;

        if (location) {
          const text = location.address || location.label || label;
          nodes.push({
            kind: "link",
            href: locationDirectionsUrl(location, detectedMapPlatform()),
            children: [{ kind: "text", value: text }],
          });
        } else if (!hasSeparator && markerBody) {
          // Backwards compatibility: the old marker held a place name.
          if (markerBody.length <= LOCATION_MARKER_MAX_LENGTH) {
            nodes.push({
              kind: "link",
              href: mapsHref(markerBody),
              children: [{ kind: "text", value: markerBody }],
            });
          } else {
            nodes.push({
              kind: "text",
              value: markerBody.slice(0, LOCATION_MARKER_MAX_LENGTH),
            });
          }
        } else if (label) {
          // Unknown id: show the readable label without inventing a map link.
          nodes.push({
            kind: "text",
            value: label.slice(0, LOCATION_MARKER_MAX_LENGTH),
          });
        }
        index += locationMarker[0].length;
        continue;
      }

      const remaining = source.slice(index);
      const lowerRemaining = remaining.toLowerCase();
      if (lowerRemaining.startsWith(LOCATION_MARKER_PREFIX)) {
        const partialBody = remaining.slice(LOCATION_MARKER_PREFIX.length);
        if (!partialBody.includes("\n")) {
          flush();
          const visibleText = partialLocationText(partialBody);
          if (visibleText) {
            nodes.push({
              kind: "text",
              value: visibleText.slice(0, LOCATION_MARKER_MAX_LENGTH),
            });
          }
          index = source.length;
          continue;
        }
      } else if (
        remaining.length < LOCATION_MARKER_PREFIX.length &&
        LOCATION_MARKER_PREFIX.startsWith(lowerRemaining)
      ) {
        // The marker is still arriving; do not show `[[location:` as text.
        flush();
        index = source.length;
        continue;
      }

      const match = /^\[([^\]]*)\]\(([^)\s]+)\)/.exec(source.slice(index));
      const href = match?.[2] ?? "";
      if (match && isSafeLinkUrl(href)) {
        flush();
        nodes.push({
          kind: "link",
          href,
          children: parseInline(match[1] ?? "", locationMap, false),
        });
        index += match[0].length;
        continue;
      }
    }

    // Bare URLs, only at a word boundary so `xhttps://…` stays text.
    if (
      allowAutolinks &&
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

    if (allowAutolinks) {
      const contact = contactAutolinkAt(source, index);
      if (contact) {
        flush();
        nodes.push({
          kind: "link",
          href: contact.href,
          children: [{ kind: "text", value: contact.text }],
        });
        index += contact.text.length;
        continue;
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
