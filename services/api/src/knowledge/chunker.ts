export type ChunkOptions = {
  maxChars?: number;
  overlap?: number;
};

/**
 * Splits plain text into chunks for embedding. Splits on paragraph breaks,
 * then on sentence breaks, hard-cutting at maxChars. Chunks are trimmed and
 * empty chunks are dropped.
 */
export function chunkText(
  content: string,
  { maxChars = 900, overlap = 120 }: ChunkOptions = {},
): string[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const units = text
    .split(/\n{2,}/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/));

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const unit of units) {
    const piece = unit.trim();
    if (!piece) continue;

    if (piece.length > maxChars) {
      push();
      current = "";
      for (let i = 0; i < piece.length; i += maxChars - overlap) {
        chunks.push(piece.slice(i, i + maxChars).trim());
      }
      continue;
    }

    if (current.length + piece.length + 1 > maxChars) {
      push();
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  push();

  return chunks;
}
