// ---------------------------------------------------------------------------
  // Register the custom element
  // ---------------------------------------------------------------------------
  // Guard against browsers that don't support Web Components.
  // The try/catch handles the case where the script is loaded multiple times
  // (e.g. hot reload, dual script tags) — re-defining throws an error.
  if (!("customElements" in window)) {
    console.error("[zy-widget] customElements is not supported in this browser");
    return;
  }

  try {
    customElements.define("zy-widget", ZyWidget);
  } catch (_) {
    /* already defined */
  }

  // ---------------------------------------------------------------------------
  // Public registration API
  // ---------------------------------------------------------------------------
  // Lets a widget be registered without editing the build, and lets the contract
  // be exercised by tests. Not a capability grant: registering a variant only
  // supplies markup and styles, and <zy-widget> is already in the page's global
  // registry.
  window.ZyWidget = {
    register: registerWidget,
    list: function () {
      return Object.keys(VARIANTS);
    },
    resolve: resolveVariant,
  };
})();