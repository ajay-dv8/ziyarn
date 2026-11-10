/* Trigger: bubble — the plain chat-icon circle, on any widget. */
registerTrigger("bubble", {
  css: TRIGGER_CSS.bubble,
  /**
   * @param {{label: string}} config
   */
  markup: function (config) {
    void config;
    return (
      '<button type="button" class="zy-launcher zy-trigger-bubble" aria-label="Open chat">' +
      '<span class="zy-open">' +
      TRIGGER_ICONS.chat +
      '<img class="zy-trigger-logo" alt="" hidden /></span>' +
      '<span class="zy-close">' +
      TRIGGER_ICONS.close +
      "</span>" +
      "</button>"
    );
  },
});
