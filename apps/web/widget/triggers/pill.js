// Trigger: pill — accent pill with the chat icon and the owner's text.
registerTrigger("pill", {
  css: TRIGGER_CSS.pill,
  /**
   * @param {{label: string}} config
   */
  markup: function (config) {
    // esc() — the label is owner input and renderMd's escaper is already in
    // scope; the tooltip copy is set with textContent by the engine instead.
    return (
      '<button type="button" class="zy-launcher zy-trigger-pill" aria-label="Open chat">' +
      '<span class="zy-open">' +
      TRIGGER_ICONS.chat +
      "</span>" +
      '<span class="zy-close">' +
      TRIGGER_ICONS.close +
      "</span>" +
      '<span class="zy-label">' +
      esc(config.label || TRIGGER_TEXT_DEFAULT) +
      "</span>" +
      "</button>"
    );
  },
});
