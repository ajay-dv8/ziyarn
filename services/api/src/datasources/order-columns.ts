export type MappedOrder = {
  externalKey: string;
  email: string | null;
  description: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: Date | null;
};

export type OrderColumnMapping = {
  id: string | null;
  email: string | null;
  description: string | null;
  amount: string | null;
  cents: boolean;
  status: string | null;
  date: string | null;
};

function isEmailColumn(columnName: string): boolean {
  return /e-?mail|customer_?email|buyer_?email|user_?email/i.test(columnName);
}

function isAmountColumn(columnName: string): boolean {
  return /amount|total|price|cost|payment|revenue|billing/i.test(columnName);
}

function isOrderStatusColumn(columnName: string): boolean {
  return /status|state|phase|step/i.test(columnName);
}

function isDateColumn(columnName: string): boolean {
  return /date|created|timestamp|ordered|placed|time/i.test(columnName);
}

function isDescriptionColumn(columnName: string): boolean {
  return /desc(ription)?|details?|item|product|name|title|summary|note/i.test(
    columnName,
  );
}

function isOrderIdentifierColumn(columnName: string): boolean {
  return /^(_?id|order_?id|order_?number|order_?code|invoice|reference|uuid)$/i.test(
    columnName,
  );
}

/** Picks the columns that define an order row, or null when not one. */
export function mapOrderColumns(
  columns: Array<{ name: string; type: string }>,
): OrderColumnMapping | null {
  const email =
    columns.find((column) => isEmailColumn(column.name))?.name ?? null;

  const amountCol =
    columns.find((column) => isAmountColumn(column.name)) ?? null;

  // Need at least an amount column to recognize an orders table.
  if (!amountCol) return null;

  const id =
    columns.find((column) => isOrderIdentifierColumn(column.name))?.name ?? null;
  const description =
    columns.find((column) => isDescriptionColumn(column.name))?.name ?? null;
  const status =
    columns.find((column) => isOrderStatusColumn(column.name))?.name ?? null;
  const date =
    columns.find((column) => isDateColumn(column.name))?.name ?? null;

  return {
    id,
    email,
    description,
    amount: amountCol.name,
    cents: /_?cents?$/i.test(amountCol.name),
    status,
    date,
  };
}

function parseAmount(
  raw: unknown,
  cents: boolean,
): number | null {
  const num =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(num) || num < 0) return null;
  return cents ? Math.round(num) : Math.round(num * 100);
}

function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date) return raw;
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "order"
  );
}

/**
 * Maps one source row to an order. Returns null for rows without a usable
 * amount.
 */
export function mapOrderRow(params: {
  row: Record<string, unknown>;
  tableName: string;
  mapping: OrderColumnMapping;
}): MappedOrder | null {
  const { row, tableName, mapping } = params;

  if (!mapping.amount) return null;

  const amountMinor = parseAmount(row[mapping.amount], mapping.cents);
  if (amountMinor === null) return null;

  const rawEmail = mapping.email ? row[mapping.email] : null;
  const email =
    typeof rawEmail === "string" && rawEmail.trim()
      ? rawEmail.trim()
      : null;

  const rawDesc = mapping.description ? row[mapping.description] : null;
  const description =
    typeof rawDesc === "string" && rawDesc.trim()
      ? rawDesc.trim().slice(0, 500)
      : null;

  const rawStatus = mapping.status ? row[mapping.status] : null;
  const status =
    typeof rawStatus === "string" && rawStatus.trim()
      ? normalizeOrderStatus(rawStatus.trim())
      : "paid";

  const createdAt = mapping.date ? parseDate(row[mapping.date]) : null;

  const rawId = mapping.id ? row[mapping.id] : null;
  const idValue =
    typeof rawId === "string" || typeof rawId === "number"
      ? String(rawId)
      : "";
  const externalKey = idValue
    ? `${tableName}:${idValue}`
    : `${tableName}:${slugify(description ?? email ?? "order")}`;

  return {
    externalKey,
    email,
    description,
    amountMinor,
    currency: "ghs",
    status,
    createdAt,
  };
}

function normalizeOrderStatus(raw: string): string {
  const lower = raw.toLowerCase();
  if (/paid|complete|done|fulfilled|success/.test(lower)) return "paid";
  if (/pend|wait|processing|open/.test(lower)) return "pending";
  if (/fail|error|declined|denied/.test(lower)) return "failed";
  if (/cancel|refunded|void/.test(lower)) return "failed";
  return "paid";
}
