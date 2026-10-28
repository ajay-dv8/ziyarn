export type KnowledgeResultHit = {
  text: string;
  title: string | null;
  url: string | null;
};

/**
 * Formats knowledge hits for the model. A source line gives the model the
 * exact page URL to link to; it must never have to construct one from the
 * domain slug. Hits without a public URL still keep their title so uploaded
 * documents remain attributable without inventing a link.
 */
export function formatKnowledgeHits(
  hits: readonly KnowledgeResultHit[],
): string {
  return hits
    .map((hit, index) => {
      const source = hit.url
        ? `Source: ${hit.title ? `${hit.title} — ` : ""}${hit.url}`
        : hit.title
          ? `Source: ${hit.title}`
          : "";
      return `[${index + 1}] ${hit.text}${source ? `\n${source}` : ""}`;
    })
    .join("\n\n");
}
