/**
 * In-memory sliding-window rate limiter for the public chat API.
 * This is transient infrastructure state (not business data) and resets on
 * process restart — acceptable per roadmap ("rate limit (in-memory/Redis)");
 * swap the backend for Redis when the widget is deployed multi-instance.
 */
export class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if the key is allowed, false if it exceeds the limit. */
  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter(
      (t) => t > cutoff,
    );

    if (timestamps.length >= this.max) {
      this.buckets.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return true;
  }
}

const MESSAGE_LIMIT = 10;
const MESSAGE_WINDOW_MS = 60_000;

export const chatRateLimiter = new SlidingWindowRateLimiter(
  MESSAGE_LIMIT,
  MESSAGE_WINDOW_MS,
);
