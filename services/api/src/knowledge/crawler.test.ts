import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { crawlWebsite, isBlockedHost, createDefaultFetchPage } from "@repo/api/knowledge/crawler";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal("fetch", originalFetch);
});

afterEach(() => {
  vi.stubGlobal("fetch", originalFetch);
});

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

describe("isBlockedHost", () => {
  it.each([
    "127.0.0.1",
    "127.0.0.53",
    "10.0.0.1",
    "10.255.255.255",
    "100.64.0.1",
    "100.127.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "192.168.255.255",
    "169.254.169.254",
    "169.254.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "239.255.255.255",
    "240.0.0.1",
    "255.255.255.255",
    "198.51.100.23",
    "203.0.113.5",
    "::1",
    "::",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "feb0::1",
    "ff02::1",
    "2001:db8::1",
  ])("blocks private/reserved IPv4/IPv6: %s", async (host) => {
    expect(await isBlockedHost(host)).toBe(true);
  });

  it.each(["localhost", "localhost.localdomain"])(
    "blocks localhost hostname: %s",
    async (host) => {
      expect(await isBlockedHost(host)).toBe(true);
    },
  );

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "9.9.9.9",
    "2001:4860:4860::8888",
  ])("allows public IP: %s", async (host) => {
    expect(await isBlockedHost(host)).toBe(false);
  });

  it("treats DNS resolution failure as blocked", async () => {
    expect(await isBlockedHost("this-domain-does-not-exist-xyz123.invalid")).toBe(true);
  });
});

describe("createDefaultFetchPage", () => {
  it.each([
    "http://127.0.0.1/",
    "http://169.254.169.254/",
    "http://10.0.0.1/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://[fc00::1]/",
  ])("throws SSRF error for private host: %s", async (url) => {
    const fetchPage = createDefaultFetchPage();
    await expect(fetchPage(url)).rejects.toThrow(/SSRF/);
  });

  it("does not call fetch for a blocked host", async () => {
    const fetchPage = createDefaultFetchPage();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchPage("http://127.0.0.1/")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls fetch for an allowed public host", async () => {
    const fetchPage = createDefaultFetchPage();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("<html><body>ok</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await fetchPage("https://example.com/");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
