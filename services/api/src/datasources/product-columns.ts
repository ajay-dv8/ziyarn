import { isProductPageUrl } from "@repo/api/products/url";

export type MappedProduct = {
  externalKey: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  priceCents: number;
  active: boolean;
  availability: string | null;
};

export type ProductColumnMapping = {
  name: string;
  price: string;
  cents: boolean;
  description: string | null;
  image: string | null;
  productUrl: string | null;
  stock: string | null;
  key: string | null;
};

export function isPriceColumn(columnName: string): boolean {
  return /price|amount|cost|rate|fare/i.test(columnName);
}

function isExcludedNameColumn(columnName: string): boolean {
  return /e-?mail|user(name)?$/i.test(columnName);
}

function isProductTitleColumn(columnName: string): boolean {
  return (
    /(^|_)(name|title|label)$/i.test(columnName) ||
    /^(product_?name|item_?name)$/i.test(columnName)
  );
}

/** Picks the columns that define a product row, or null when not one. */
export function mapProductColumns(
  columns: Array<{ name: string; type: string }>,
): ProductColumnMapping | null {
  const name =
    columns.find(
      (column) => !isExcludedNameColumn(column.name) && isProductTitleColumn(column.name),
    )?.name ?? null;
  const priceCol = columns.find((column) => isPriceColumn(column.name)) ?? null;
  if (!name || !priceCol) return null;

  const description =
    columns.find((column) => /desc(ription)?|details?/i.test(column.name))?.name ?? null;
  const stock =
    columns.find((column) =>
      /stock|qty|quantity|available|inventory/i.test(column.name),
    )?.name ?? null;
  const image =
    columns.find((column) => /^(image|image_?url|photo|photo_?url|thumbnail|picture)$/i.test(column.name))?.name ?? null;
  const productUrl =
    columns.find((column) =>
      /^(url|link|permalink|product_?url|product_?page(?:_?url)?|page_?url|website_?url)$/i.test(column.name),
    )?.name ?? null;
  const key =
    columns.find((column) =>
      /^(_?id|uuid|sku|code|product_?code|product_?key)$/i.test(column.name),
    )?.name ?? null;

  return {
    name,
    price: priceCol.name,
    cents: /_?cents?$/i.test(priceCol.name),
    description,
    image,
    productUrl,
    stock,
    key,
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

/**
 * Maps one source row to a product. Returns null for rows without a usable
 * name or non-negative numeric price.
 */
export function mapProductRow(params: {
  row: Record<string, unknown>;
  tableName: string;
  mapping: ProductColumnMapping;
}): MappedProduct | null {
  const { row, tableName, mapping } = params;

  const rawName = row[mapping.name];
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return null;

  const rawPrice = row[mapping.price];
  const priceNumber =
    typeof rawPrice === "number"
      ? rawPrice
      : typeof rawPrice === "string"
        ? Number(rawPrice)
        : NaN;
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return null;
  const priceCents = Math.round(mapping.cents ? priceNumber : priceNumber * 100);

  const rawDescription = mapping.description ? row[mapping.description] : null;
  const description =
    typeof rawDescription === "string" && rawDescription.trim()
      ? rawDescription.trim().slice(0, 500)
      : null;
  const rawImageUrl = mapping.image ? row[mapping.image] : null;
  const imageUrl =
    typeof rawImageUrl === "string" && /^https?:\/\//i.test(rawImageUrl.trim())
      ? rawImageUrl.trim().slice(0, 2_000)
      : null;

  const rawProductUrl = mapping.productUrl ? row[mapping.productUrl] : null;
  const productUrlValue =
    typeof rawProductUrl === "string" ? rawProductUrl.trim() : "";
  const productUrl =
    productUrlValue.length > 0 &&
    productUrlValue.length <= 2_000 &&
    isProductPageUrl(productUrlValue)
      ? productUrlValue
      : null;

  let active = true;
  let availability: string | null = null;
  if (mapping.stock) {
    const rawStock = row[mapping.stock];
    if (typeof rawStock === "boolean") {
      active = rawStock;
      availability = rawStock ? "In stock" : "Out of stock";
    } else if (typeof rawStock === "number" && Number.isFinite(rawStock)) {
      active = rawStock > 0;
      availability =
        rawStock > 0 ? `${Math.round(rawStock)} in stock` : "Out of stock";
    }
  }

  const rawKey = mapping.key ? row[mapping.key] : null;
  const keyValue =
    typeof rawKey === "string" || typeof rawKey === "number"
      ? String(rawKey)
      : "";
  const externalKey = keyValue
    ? `${tableName}:${keyValue}`
    : `${tableName}:${slugify(name)}`;

  return {
    externalKey,
    name: name.slice(0, 200),
    description,
    imageUrl,
    productUrl,
    priceCents,
    active,
    availability,
  };
}
