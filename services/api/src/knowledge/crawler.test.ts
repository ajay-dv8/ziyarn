import { describe, expect, it } from "vitest";

import { crawlWebsite } from "@repo/api/knowledge/crawler";

describe("crawlWebsite private pages", () => {
  it("does not crawl or persist account/order pages", async () => {
    const fetched: string[] = [];
    const saved: string[] = [];

    const result = await crawlWebsite(
      {
        fetchPage: async (url) => {
          fetched.push(url);
          if (url === "https://shop.example/") {
            return [
              "<title>Shop</title>",
              "<p>Home</p>",
              '<a href="/about">About</a>',
              '<a href="/orders">My orders</a>',
              '<a href="/checkout">Checkout</a>',
            ].join("");
          }
          return "<title>About</title><p>About the shop</p>";
        },
        onPage: async (page) => {
          saved.push(page.url);
        },
      },
      { startUrl: "https://shop.example/" },
    );

    expect(fetched).toContain("https://shop.example/about");
    expect(fetched).not.toContain("https://shop.example/orders");
    expect(fetched).not.toContain("https://shop.example/checkout");
    expect(saved).toContain("https://shop.example/about");
    expect(result.pagesCrawled).toBe(2);
  });
});
