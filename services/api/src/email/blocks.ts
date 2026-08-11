export type EmailBlock =
  | { kind: "heading"; id: string; size: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; id: string; text: string }
  | { kind: "button"; id: string; text: string; url: string }
  | { kind: "image"; id: string; url: string; alt: string }
  | { kind: "divider"; id: string }
  | { kind: "spacer"; id: string; height: 8 | 16 | 24 | 32 };

export type EmailBlockKind = EmailBlock["kind"];

export const EMAIL_BLOCK_META: Array<{
  kind: EmailBlockKind;
  label: string;
}> = [
  { kind: "heading", label: "Heading" },
  { kind: "paragraph", label: "Paragraph" },
  { kind: "button", label: "Button" },
  { kind: "image", label: "Image" },
  { kind: "divider", label: "Divider" },
  { kind: "spacer", label: "Spacer" },
];

export function createBlock(
  kind: EmailBlockKind,
  id = crypto.randomUUID(),
): EmailBlock {
  switch (kind) {
    case "heading":
      return { kind, id, size: 2, text: "Enter a heading" };
    case "paragraph":
      return { kind, id, text: "" };
    case "button":
      return { kind, id, text: "Click here", url: "" };
    case "image":
      return { kind, id, url: "", alt: "" };
    case "divider":
      return { kind, id };
    case "spacer":
      return { kind, id, height: 16 };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function wordsToLines(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => escapeHtml(line.trim()) || "&nbsp;")
    .join("<br/>");
}

export function renderEmailBody(blocks: EmailBlock[]): string {
  const parts = blocks.map((block) => renderBlock(block)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;"><tr><td style="padding:28px;">
      ${parts}
    </td></tr></table>
  </td></tr></table>
</body></html>`;
}

function renderBlock(block: EmailBlock): string {
  switch (block.kind) {
    case "heading": {
      const style =
        block.size === 1
          ? { margin: "0 0 12px", size: "24px" }
          : block.size === 2
            ? { margin: "0 0 12px", size: "20px" }
            : { margin: "0 0 12px", size: "17px" };
      return `<h1 style="margin:${style.margin};font-size:${style.size};line-height:1.3;color:#18181b;">${wordsToLines(block.text)}</h1>`;
    }
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">${wordsToLines(block.text)}</p>`;
    case "button": {
      const text = escapeHtml(block.text || "Click here");
      const href = block.url ? `href="${escapeHtml(block.url)}"` : 'href="#"';
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-radius:8px;background-color:#18181b;"><a ${href} style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${text}</a></td></tr></table>`;
    }
    case "image":
      if (!block.url) return "";
      return `<img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" style="display:block;width:100%;height:auto;border-radius:8px;margin:0 0 16px;border:0;"/>`;
    case "divider":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-top:1px solid #e4e4e7;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
    case "spacer":
      return `<div role="presentation" style="height:${block.height}px;line-height:${block.height}px;">&nbsp;</div>`;
  }
}