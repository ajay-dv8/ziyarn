/**
 * Rate limiting for the public chat API.
 *
 * The in-memory limiter is a fast first layer. The shared limiter adds a
 * database-backed second layer so limits survive deploys and span all
 * serverless instances. This module stays dependency-free so the class can be
 * unit-tested without a database.
 */

export const CHAT_MESSAGE_LIMIT = 10;
export const CHAT_MESSAGE_WINDOW_MS = 60_000;

export type RateLimitStore = {
  /** Atomically increments the counter for a key/window and returns the new total. */
  increment: (key: string, windowStart: Date) => Promise<number>;
  /** Deletes rows whose window started before `before`; returns the row count. */
  prune: (before: Date) => Promise<number>;
};

/**
 * In-memory sliding-window limiter.
 *
 * This is transient infrastructure state (not business data) and resets on
 * process restart. It remains useful as a hot-path guard, but it cannot enforce
 * a global limit on its own; `SharedRateLimiter` supplies the database layer.
 */
export class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns true if the key is allowed, false if it exceeds the limit. */
  check(key: string): boolean {
    const currentTime = this.now();
    const cutoff = currentTime - this.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (timestamps.length >= this.max) {
      this.buckets.set(key, timestamps);
      return false;
    }

    timestamps.push(currentTime);
    this.buckets.set(key, timestamps);
    return true;
  }
}

export type SharedRateLimiterOptions = {
  store: RateLimitStore;
  max: number;
  windowMs: number;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Called when the shared store fails; the limiter then fails open. */
  onStoreError?: (error: unknown) => void;
};

/**
 * Combines the in-memory limiter with a shared database counter.
 *
 * The local limiter is checked first so a burst cannot cause a database write
 * for every message. The database increment is atomic, so two instances cannot
 * both grant the last slot in a window. If the database is unavailable we fail
 * open and report the error: the per-domain daily cap and plan limits still
 * protect the product, and blocking all chat during a database blip would be
 * worse than briefly allowing extra messages.
 */
export class SharedRateLimiter {
  private readonly localLimiter: SlidingWindowRateLimiter;
  private readonly now: () => number;

  constructor(private readonly options: SharedRateLimiterOptions) {
    this.now = options.now ?? Date.now;
    this.localLimiter = new SlidingWindowRateLimiter(
      options.max,
      options.windowMs,
      this.now,
    );
  }

  async check(key: string): Promise<boolean> {
    if (!this.localLimiter.check(key)) {
      return false;
    }

    const windowStart = new Date(
      Math.floor(this.now() / this.options.windowMs) * this.options.windowMs,
    );

    try {
      const count = await this.options.store.increment(key, windowStart);
      return count <= this.options.max;
    } catch (error) {
      this.options.onStoreError?.(error);
      return true;
    }
  }

  async prune(before: Date): Promise<number> {
    return this.options.store.prune(before);
  }
}
