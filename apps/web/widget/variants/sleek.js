  // Modern Sleek is the React surface at /embed/<slug>. The script owns only
  // the launcher and the full-screen frame, so a customer embeds it with the
  // same <zy-widget> tag as Classic and Glow.
  var SLEEK_ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  registerWidget("sleek", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.sleek.
    css: VARIANT_CSS.sleek,
    // Tells the engine to skip the panel wiring and mount the iframe instead.
    iframe: true,

    /**
     * @param {{title: string, subtitle: string, color: string, position: string, trigger: string|null}} config
     */
    markup: function (config) {
      // A domain that picked a chat trigger renders THAT launcher instead
      // (the engine mounts it after this markup); "default" keeps our orb.
      var launcher = config.trigger
        ? ""
        : ('<button type="button" class="zy-launcher" aria-label="Open chat" aria-expanded="false">' +
          '<span class="zy-open">' +
          SLEEK_ICONS.chat +
          '</span><span class="zy-close">' +
          SLEEK_ICONS.close +
          "</span>" +
          "</button>");
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="sleek" data-open="false">' +
        launcher +
        '<div class="zy-sleek-overlay" hidden>' +
        '<iframe class="zy-sleek-frame" title="Chat with us" allow="clipboard-write; web-share" referrerpolicy="no-referrer"></iframe>' +
        "</div>" +
        "</div>"
      );
    },
  });
