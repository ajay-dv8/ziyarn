  // Icons belong to the variant: a widget that looks nothing like Classic
  // brings its own. Glow's launcher is a small orbit rather than a speech bubble.
  var GLOW_ICONS = {
    chat:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-28 12 12)"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/></svg>',
  };

  registerWidget("glow", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.glow.
    css: VARIANT_CSS.glow,

    /**
     * @param {{title: string, subtitle: string, color: string, position: string}} config
     */
    markup: function (config) {
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="glow">' +
        '<div class="zy-panel">' +
        // Sits behind the content, clipped by the panel's overflow:hidden.
        '<div class="zy-aurora" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '<div class="zy-header">' +
        '<img class="zy-header-logo" alt="" hidden />' +
        '<div class="zy-header-title"></div>' +
        '<div class="zy-header-sub"></div>' +
        '<div class="zy-header-status" data-visible="false"></div>' +
        '<button type="button" class="zy-header-close" aria-label="Close chat">' +
        GLOW_ICONS.close +
        "</button>" +
        "</div>" +
        '<div class="zy-messages"></div>' +
        '<div class="zy-composer" data-expanded="false">' +
        '<div class="zy-composer-shell">' +
        '<div class="zy-composer-row">' +
        '<div class="zy-composer-field">' +
        '<input type="text" placeholder=" " aria-label="Type a message" autocomplete="off" />' +
        '<div class="zy-composer-ph" aria-hidden="true"></div>' +
        "</div>" +
        '<button type="button" class="zy-send" aria-label="Send message">' +
        GLOW_ICONS.send +
        "</button>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div class="zy-note">Powered by Ziyarn</div>' +
        "</div>" +
        '<button type="button" class="zy-launcher" aria-label="Open chat">' +
        '<span class="zy-open">' +
        GLOW_ICONS.chat +
        '</span><span class="zy-close">' +
        GLOW_ICONS.close +
        "</span>" +
        "</button>" +
        "</div>"
      );
    },

    /**
     * Replaces the bouncing typing dots with the thinking orb.
     *
     * The engine calls this when a request goes out and calls `.done()` on the
     * returned controller the moment the first token lands, so the orb always
     * hands the bubble back empty for the real reply. Both the orb and the
     * typing dots are strictly placeholders — neither ever holds the answer.
     */
    onThinking: function (node) {
      return moCreateThinking(node, { speed: 1 });
    },
  });
