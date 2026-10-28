import { describe, expect, it } from "vitest";

import {
  isPrivatePageUrl,
  publicSourceUrl,
} from "@repo/api/knowledge/source-links";

describe("publicSourceUrl", () => {
  it("accepts a crawled public page URL", () => {
    expect(publicSourceUrl("https://www.urbanplusgh.com/about")).toBe(
      "https://www.urbanplusgh.com/about",
    );
  });

  it("rejects uploaded file names and non-http values", () => {
    expect(publicSourceUrl("lazy.docx")).toBeNull();
    expect(publicSourceUrl("javascript:alert(1)")).toBeNull();
    expect(publicSourceUrl(null)).toBeNull();
  });

  it("rejects private account and checkout pages", () => {
    expect(publicSourceUrl("https://shop.example/orders")).toBeNull();
    expect(publicSourceUrl("https://shop.example/account/settings")).toBeNull();
    expect(publicSourceUrl("https://shop.example/cart")).toBeNull();
  });

  it("strips hash fragments from public URLs", () => {
    expect(publicSourceUrl("https://shop.example/about#team")).toBe(
      "https://shop.example/about",
    );
  });
});

describe("isPrivatePageUrl", () => {
  it("matches exact routes, nested routes, and trailing-slash routes", () => {
    expect(isPrivatePageUrl("https://shop.example/orders")).toBe(true);
    expect(isPrivatePageUrl("https://shop.example/orders/123")).toBe(true);
    expect(isPrivatePageUrl("https://shop.example/order/123")).toBe(true);
    expect(isPrivatePageUrl("https://shop.example/my-account")).toBe(true);
    expect(isPrivatePageUrl("https://shop.example/my/orders")).toBe(true);
  });

  it("does not match public routes that merely share a prefix", () => {
    expect(isPrivatePageUrl("https://shop.example/about")).toBe(false);
    expect(isPrivatePageUrl("https://shop.example/order-status")).toBe(false);
    expect(isPrivatePageUrl("https://shop.example/blog/accounting")).toBe(
      false,
    );
  });
});
