import { describe, expect, it, vi } from "vitest";

import {
  CHAT_MESSAGE_LIMIT,
  CHAT_MESSAGE_WINDOW_MS,
  SharedRateLimiter,
  type RateLimitStore,
} from "./rate-limit";

/**
 * In-memory stand-in for the Postgres store. The increment body has no await,
 * so each call reads and writes the counter atomically — the same guarantee the
 * real single-statement upsert provides.
 */
class FakeRateLimitStore implements RateLimitStore {
  private readonly counts = new Map<string, number>();

  async increment(key: string, windowStart: Date): Promise<number> {
    const bucket = `${key}|${windowStart.toISOString()}`;
    const next = (this.counts.get(bucket) ?? 0) + 1;
    this.counts.set(bucket, next);
    return next;
  }

  async prune(before: Date): Promise<number> {
    let deleted = 0;
    for (const bucket of this.counts.keys()) {
      const windowStart = new Date(bucket.split("|").at(-1) ?? 0);
      if (windowStart < before) {
        this.counts.delete(bucket);
        deleted += 1;
      }
    }
    return deleted;
  }
}

const KEY = "chat:domain-1:visitor-1";

function createLimiter(
  store: RateLimitStore,
  options: { now?: () => number; onStoreError?: (error: unknown) => void } = {},
) {
  return new SharedRateLimiter({
    store,
    max: CHAT_MESSAGE_LIMIT,
    windowMs: CHAT_MESSAGE_WINDOW_MS,
    ...options,
  });
}

describe("SharedRateLimiter", () => {
  it("allows ten messages and rejects the eleventh", async () => {
    const limiter = createLimiter(new FakeRateLimitStore());

    for (let messageIndex = 0; messageIndex < CHAT_MESSAGE_LIMIT; messageIndex++) {
      expect(await limiter.check(KEY)).toBe(true);
    }

    expect(await limiter.check(KEY)).toBe(false);
  });

  it("shares one limit across two server instances", async () => {
    const store = new FakeRateLimitStore();
    const instanceA = createLimiter(store);
    const instanceB = createLimiter(store);

    const results = await Promise.all(
      Array.from({ length: CHAT_MESSAGE_LIMIT * 2 }, (_, index) =>
        (index % 2 === 0 ? instanceA : instanceB).check(KEY),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(CHAT_MESSAGE_LIMIT);
    expect(results.filter((allowed) => !allowed)).toHaveLength(
      CHAT_MESSAGE_LIMIT,
    );
  });

  it("starts a fresh count after the window closes", async () => {
    let now = 0;
    const limiter = createLimiter(new FakeRateLimitStore(), { now: () => now });

    for (let messageIndex = 0; messageIndex < CHAT_MESSAGE_LIMIT; messageIndex++) {
      expect(await limiter.check(KEY)).toBe(true);
    }
    expect(await limiter.check(KEY)).toBe(false);

    now = CHAT_MESSAGE_WINDOW_MS;
    expect(await limiter.check(KEY)).toBe(true);
  });

  it("fails open and reports the store error", async () => {
    const onStoreError = vi.fn();
    const limiter = createLimiter(
      {
        increment: async () => {
          throw new Error("database unavailable");
        },
        prune: async () => 0,
      },
      { onStoreError },
    );

    expect(await limiter.check(KEY)).toBe(true);
    expect(onStoreError).toHaveBeenCalledOnce();
  });

  it("prunes counters from closed windows", async () => {
    const store = new FakeRateLimitStore();
    await store.increment("old", new Date(0));
    await store.increment("current", new Date(CHAT_MESSAGE_WINDOW_MS));

    const limiter = createLimiter(store);
    expect(await limiter.prune(new Date(CHAT_MESSAGE_WINDOW_MS))).toBe(1);
  });
});
