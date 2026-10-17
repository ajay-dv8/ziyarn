  var DEFAULT_API_BASE = (function () {
    try {
      return new URL(SCRIPT_SRC, location.href).origin;
    } catch (_) {
      return location.origin;
    }
  })();

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---------------------------------------------------------------------------
  // Helper: escape HTML special characters (XSS prevention)
  // ---------------------------------------------------------------------------
  // Used by renderMd() to sanitize AI output before injecting HTML.
  // Must be called BEFORE any markdown-to-HTML conversion so that raw HTML
  // in AI responses (e.g. <script>) is neutralized.
  function esc(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------------------------------------------------------------------------
  // Lightweight markdown → HTML renderer
  // ---------------------------------------------------------------------------
  // Converts a small subset of markdown into HTML for agent messages.
  // Order matters: esc() first (prevents XSS), then apply formatting tags.
  //
  // Supported syntax:
  //   **bold**    → <strong>bold</strong>
  //   *italic*    → <em>italic</em>
  //   `code`      → <code>code</code>
  //   \n          → <br>
  //   em-dash (—) → " — " (spaced, for readability)
  //   en-dash (–) → " - " (spaced, for readability)
  //
  // NOT supported (intentionally): tables, links, images, headers, lists.
  // This keeps the renderer fast and safe for untrusted AI output.
  function renderMd(text) {
    if (!text) return "";
    var s = esc(text);
    s = s.replace(/\u2014/g, " \u2014 "); // em-dash → spaced
    s = s.replace(/\u2013/g, " - ");       // en-dash → hyphen
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  // ---------------------------------------------------------------------------
  // ZyWidget — custom element class
  // ---------------------------------------------------------------------------
  // Lifecycle: constructor() → connectedCallback() → (user interacts) → disconnectedCallback()
  // The widget manages its own state (open/closed, streaming, conversation ID)

  var VARIANTS = {};
  var DEFAULT_VARIANT_ID = "classic";

  /**
   * @param {string} id
   * @param {{
   *   css: string,
   *   markup: function(object): string,
   *   onThinking?: function(HTMLElement, object): {
   *     done: function(): Promise<void>|void,
   *     destroy?: function(): void
   *   }
   * }} variant
   *
   * `onThinking` is optional. Without it the engine renders the bouncing typing
   * dots. With it, the variant owns the placeholder bubble from the moment a
   * request goes out until it calls `done()` (answer incoming — may be async,
   * the engine waits for the node) or `destroy()` (error, escalation, teardown).
   * A controller that never settles would strand an empty bubble, so both paths
   * must be reachable.
   */
  function registerWidget(id, variant) {
    VARIANTS[id] = variant;
  }

  /**
   * Resolves data-variant to a registered variant, FAILING OPEN.
   *
   * Every widget already embedded on a customer site predates this attribute,
   * so a missing value must mean classic. A typo must never leave a paying
   * customer's website with a blank chat widget — warn and fall back.
   */
  function resolveVariant(name) {
    var fallback = VARIANTS[DEFAULT_VARIANT_ID];
    if (typeof name === "string") {
      var key = name.trim();
      if (key) {
        if (VARIANTS[key]) return VARIANTS[key];
        console.warn(
          '[zy-widget] unknown data-variant "' +
            key +
            '" — falling back to ' +
            DEFAULT_VARIANT_ID
        );
      }
    }
    return fallback;
  }