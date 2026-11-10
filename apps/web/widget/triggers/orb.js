/* Trigger: orb — the Strands glass orb launcher on any widget. The canvas is
   mounted by the engine right after this markup lands in the shadow root. */
registerTrigger("orb", {
  css: TRIGGER_CSS.orb,
  /**
   * @param {{label: string}} config
   */
  markup: function (config) {
    void config;
    return (
      '<button type="button" class="zy-launcher zy-trigger-orb" aria-label="Open chat">' +
      '<span class="zy-open">' +
      TRIGGER_ICONS.chat +
      "</span>" +
      '<span class="zy-close">' +
      TRIGGER_ICONS.close +
      "</span>" +
      "</button>"
    );
  },
});
