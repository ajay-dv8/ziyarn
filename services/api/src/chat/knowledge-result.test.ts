import { describe, expect, it } from "vitest";

import { formatKnowledgeHits } from "@repo/api/chat/knowledge-result";

describe("formatKnowledgeHits", () => {
  it("includes the exact source title and URL for a crawled page", () => {
    const result = formatKnowledgeHits([
      {
        text: "We are open Monday to Friday.",
        title: "About | Urban+",
        url: "https://www.urbanplusgh.com/about",
      },
    ]);

    expect(result).toContain("We are open Monday to Friday.");
    expect(result).toContain(
      "Source: About | Urban+ — https://www.urbanplusgh.com/about",
    );
  });

  it("keeps an uploaded document title without inventing a URL", () => {
    const result = formatKnowledgeHits([
      { text: "Refund policy", title: "policy.pdf", url: null },
    ]);

    expect(result).toContain("Source: policy.pdf");
    expect(result).not.toContain("http");
  });

  it("supports a URL with no title", () => {
    const result = formatKnowledgeHits([
      { text: "Contact us", title: null, url: "https://shop.example/contact" },
    ]);

    expect(result).toContain("Source: https://shop.example/contact");
  });

  it("separates multiple hits", () => {
    const result = formatKnowledgeHits([
      { text: "First", title: "One", url: "https://shop.example/one" },
      { text: "Second", title: "Two", url: "https://shop.example/two" },
    ]);

    expect(result).toContain("[1] First");
    expect(result).toContain("[2] Second");
    expect(result).toContain("\n\n[2]");
  });
});
