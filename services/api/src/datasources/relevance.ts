import type { DataSourceType } from "@repo/api/datasources/schemas";

/**
 * Table-name patterns that usually hold data useful for customer-facing
 * answers (products, bookings, pricing, availability...). Matching tables
 * are pre-selected for sync; users can override the selection.
 */
const RELEVANT_PATTERNS: RegExp[] = [
  /products?/i,
  /items?/i,
  /inventory|stock/i,
  /catalog(ue)?|menu/i,
  /bookings?/i,
  /reservations?/i,
  /appointments?/i,
  /^rooms?$|room_types?/i,
  /availabilit(y|ies)|slots?/i,
  /schedul(e|es|ing)|calendars?/i,
  /prices?|pricing|rates?|tariffs?/i,
  /plans?|packages?|tiers?/i,
  /categories?|types$|departments?/i,
  /services?/i,
  /orders?|transactions?|purchases?/i,
  /invoices?|payments?/i,
  /reviews?|ratings?|testimonials?/i,
  /faqs?|questions?|answers?/i,
  /locations?|branches?|venues?/i,
];

/** Internal/system tables that never help end-customer answers. */
const IGNORED_PATTERNS: RegExp[] = [
  /^(pg_|sql_|information)/i,
  /^_?(system|internal|tmp|temp|debug|log|logs|migration|migrations)$/i,
  /^convex_/i,
  /^auth_|^session|^account$/i,
];

export function isRelevantTable(tableName: string): boolean {
  if (IGNORED_PATTERNS.some((pattern) => pattern.test(tableName))) return false;
  return RELEVANT_PATTERNS.some((pattern) => pattern.test(tableName));
}

export function connectionSummary(
  type: DataSourceType,
  parts: Record<string, string | number | undefined>,
): { host: string | null; databaseName: string | null } {
  switch (type) {
    case "postgres":
    case "mysql":
      return {
        host: `${parts.host}:${String(parts.port ?? "")}`,
        databaseName: String(parts.database ?? "") || null,
      };
    case "mongodb": {
      let host: string | null = null;
      try {
        host =
          new URL(String(parts.uri ?? "").replace("mongodb+srv://", "https://"))
            .host ?? null;
      } catch {
        host = null;
      }
      return { host, databaseName: (parts.database as string) || null };
    }
    case "convex":
      return { host: String(parts.url ?? "") || null, databaseName: null };
  }
}
