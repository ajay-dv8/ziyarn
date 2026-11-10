/**
 * Shared bits for the chat triggers — the icons they render and the
 * customization defaults. The engine includes this file once, then the
 * trigger files that follow.
 *
 * Icons belong to the triggers as a set (a bubble, orb and pill should agree
 * with each other), separate from the variant icons in variants/*.js.
 */
var TRIGGER_ICONS = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

/** Tooltip and pill copy when the owner never wrote one. */
var TRIGGER_TEXT_DEFAULT = "Chat with us";

/**
 * Fills the stored trigger customization with runtime defaults.
 *
 * Stored values come from /api/chat (owner input, validated server-side and
 * already resolved there). When the fetch fails — or an older API answered —
 * this fills the same defaults, so every field is always present. Unknown
 * values fail open: a junk mode keeps the tooltip off rather than on.
 */
function resolveTriggerConfig(value) {
  var stored = (value && typeof value === "object") ? value : {};

  function text(name) {
    var raw = stored[name];
    return typeof raw === "string" && raw.trim()
      ? raw.trim().slice(0, 32)
      : "";
  }

  return {
    // Shown as the label on the pill trigger.
    label: text("label") || TRIGGER_TEXT_DEFAULT,
    // What sits inside the bubble trigger: "chat-icon" or "logo". The logo
    // itself arrives later, when the config request answers.
    iconSource: stored.iconSource === "logo" ? "logo" : "chat-icon",
    // The tooltip chip copy.
    tooltip: text("tooltip") || TRIGGER_TEXT_DEFAULT,
    // "never" | "hover" | "always". Defaulting to off keeps every widget that
    // predates the feature pixel-identical until its owner opts in.
    tooltipVisibility:
      stored.tooltipVisibility === "hover" || stored.tooltipVisibility === "always"
        ? stored.tooltipVisibility
        : "never",
  };
}
