import { describe, expect, it } from "vitest";

import {
  mapProductColumns,
  mapProductRow,
} from "@repo/api/datasources/product-columns";
import { createProductSchema } from "@repo/api/products/schemas";

const mapping = {
  name: "name",
  price: "price",
  cents: false,
  description: null,
  image: null,
  productUrl: "url",
  stock: null,
  key: null,
};

describe("product page columns", () => {
  it("prefers a page URL column over the image URL", () => {
    const columns = [
      { name: "name", type: "text" },
      { name: "price", type: "numeric" },
      { name: "image_url", type: "text" },
      { name: "url", type: "text" },
    ];

    expect(mapProductColumns(columns)?.productUrl).toBe("url");
  });

  it("maps absolute page URLs and rejects relative or storage values", () => {
    const product = mapProductRow({
      row: {
        name: "Tote bag",
        price: 25,
        url: "https://shop.example/products/tote",
      },
      tableName: "products",
      mapping,
    });
    expect(product?.productUrl).toBe("https://shop.example/products/tote");

    for (const url of [
      "/products/tote",
      "tote-bag",
      "javascript:alert(1)",
      "https://user:secret@shop.example/products/tote",
      "https://shop.example/account",
      "https://example.convex.cloud/api/storage/image-id",
    ]) {
      const rejected = mapProductRow({
        row: { name: "Tote bag", price: 25, url },
        tableName: "products",
        mapping,
      });
      expect(rejected?.productUrl).toBeNull();
    }
  });
});

describe("product page schema", () => {
  const base = {
    domainId: "00000000-0000-4000-8000-000000000000",
    name: "Tote bag",
    priceCents: 2500,
  };

  it("accepts an absolute http(s) URL and clearing it", () => {
    expect(
      createProductSchema.safeParse({
        ...base,
        productUrl: "https://shop.example/products/tote",
      }).success,
    ).toBe(true);
    expect(
      createProductSchema.safeParse({ ...base, productUrl: null }).success,
    ).toBe(true);
  });

  it("rejects non-page URLs", () => {
    for (const productUrl of [
      "/products/tote",
      "javascript:alert(1)",
      "https://user:secret@shop.example/products/tote",
      "https://shop.example/account",
      "https://example.convex.cloud/api/storage/image-id",
    ]) {
      expect(createProductSchema.safeParse({ ...base, productUrl }).success).toBe(
        false,
      );
    }
  });
});
