import { describe, expect, it } from "vitest";

import { scrubSentryEvent } from "./sentry-shared";

describe("scrubSentryEvent", () => {
  it("removes user identity, cookies, and sensitive headers", () => {
    const event = {
      user: { id: "user-1", email: "owner@example.com" },
      request: {
        url: "https://app.example.com/dashboard",
        cookies: { session: "secret" },
        headers: {
          authorization: "Bearer secret",
          cookie: "session=secret",
          "x-embed-secret": "embed-secret",
          accept: "application/json",
        },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request.cookies).toBeUndefined();
    expect(scrubbed.request.headers).toEqual({ accept: "application/json" });
  });

  it("strips portal tokens and emails from query strings", () => {
    const event = {
      request: {
        url: "https://app.example.com/portal/pay?token=secret&email=visitor%40example.com&tab=orders",
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request.url).toBe(
      "https://app.example.com/portal/pay?tab=orders",
    );
  });

  it("scrubs emails and phone numbers from messages and exceptions", () => {
    const event = {
      message: "Contact owner@example.com or +233 24 123 4567",
      exception: {
        values: [{ value: "Failed for visitor@example.com" }],
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.message).toBe("Contact [email] or [phone]");
    expect(scrubbed.exception.values[0]?.value).toBe("Failed for [email]");
  });

  it("does not treat dates or short ids as phone numbers", () => {
    const event = { message: "Failed on 2026-10-21 for request 12345678" };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.message).toBe(
      "Failed on 2026-10-21 for request 12345678",
    );
  });
});
