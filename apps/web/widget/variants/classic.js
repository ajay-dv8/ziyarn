// Icons belong to the variant: a widget that looks nothing like Classic
// brings its own.
  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10"/></svg>',
  };

  registerWidget("classic", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.classic.
    css: VARIANT_CSS.classic,
    /**
     * @param {{title: string, subtitle: string, color: string, position: string}} config
     */
    markup: function (config) {
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="classic">' +
        '<div class="zy-panel">' +
        '<div class="zy-header">' +
        '<div class="zy-header-title"></div>' +
        '<div class="zy-header-sub"></div>' +
        '<div class="zy-header-status" data-visible="false"></div>' +
        '<button type="button" class="zy-header-close" aria-label="Close chat">' +
        ICONS.close +
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
        ICONS.send +
        "</button>" +
        "</div>" +
        '<div class="zy-composer-caps">' +
        '<div class="zy-composer-caps-inner">' +
        '<button type="button" class="zy-chip" data-chip="deep" aria-pressed="false" aria-label="Deep search" data-open="true" hidden>' +
        ICONS.globe +
        '<span class="zy-chip-label">Deep search</span>' +
        "</button>" +
        "</div></div></div></div>" +
        '<div class="zy-note">Powered by Ziyarn</div>' +
        "</div>" +
        '<button type="button" class="zy-launcher" aria-label="Open chat">' +
        '<span class="zy-open">' +
        ICONS.chat +
        '</span><span class="zy-close">' +
        ICONS.close +
        "</span>" +
        "</button>" +
        "</div>"
      );
    },
  });
