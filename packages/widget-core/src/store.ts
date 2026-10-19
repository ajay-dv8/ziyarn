/**
 * Per-domain storage for the widget.
 *
 * Keys are namespaced by the domain slug so two widgets on one page (different
 * domains) cannot read each other's visitor id — a shared id would merge two
 * unrelated people's conversations.
 */

export type StoreKey = "visitor" | "conversation";

export interface Store {
  load(key: StoreKey): string | null;
  save(key: StoreKey, value: string): void;
}

export function createStore(slug: string): Store {
  const namespaced = (key: StoreKey) => `zy:${key}:${slug}`;

  return {
    load(key) {
      try {
        return localStorage.getItem(namespaced(key));
      } catch {
        // Private browsing, storage disabled, or a full quota. Losing the
        // visitor id costs conversation continuity; it must not throw.
        return null;
      }
    },

    save(key, value) {
      try {
        localStorage.setItem(namespaced(key), value);
      } catch {
        /* private mode — the widget still works, it just forgets */
      }
    },
  };
}

/**
 * A visitor id that survives reloads, so returning to the same site resumes the
 * same conversation. Uses crypto.randomUUID where available and falls back to a
 * random string for older browsers and private mode.
 */
export function newVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
