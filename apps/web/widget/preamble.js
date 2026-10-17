/**
 * Ziyarn widget — Shadow DOM web component (<zy-widget>).
 *
 * GENERATED FILE. Do not edit public/widget.js directly.
 * Edit the sources in apps/web/widget/ and run: pnpm --filter web build:widget
 *
 * Usage:
 *   <script defer src="https://app.ziyarn.com/widget.js"></script>
 *   <zy-widget data-slug="acme" data-secret="..." data-title="Chat with us"></zy-widget>
 *
 * Attributes:
 *   data-slug     (required) domain slug
 *   data-secret   (required) domain embed secret
 *   data-title    header title            (default "Chat with us")
 *   data-subtitle header subtitle         (default "We usually reply in minutes")
 *   data-color    launcher/accent color   (default "#10b981")
 *   data-position "bottom-right" | "bottom-left" (default "bottom-right")
 *   data-api      API base URL override   (default: origin of this script)
 *   data-variant  widget style            (default "classic" — see VARIANTS)
 *
 * Works in browsers and WebViews (no iframe). Styling is fully encapsulated in
 * the shadow root, so host page CSS cannot leak in or out.
 *
 * Architecture:
 *   1. Registers <zy-widget> via customElements.define()
 *   2. connectedCallback() reads data-* attributes and builds the shadow root
 *      from the resolved variant's CSS + markup
 *   3. Visitor messages are POSTed to /api/chat as SSE streams, rendered
 *      token by token via renderMd()
 *   4. After the AI responds, a delta loop long-polls for owner (human) replies
 *      via GET /api/chat?since=X&stream=1
 *
 * Layout of the generated file:
 *   preamble.js      this header + IIFE open + API base detection
 *   helpers.js       DOM helpers, markdown renderer, variant registry
 *   base.css         launcher / panel / header / messages styles
 *   variants/*.js    one CSS + markup pair per widget style
 *   engine.js        the ZyWidget class — all network and state
 *   epilogue.js      element registration + public API
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // API base URL detection
  // ---------------------------------------------------------------------------
  // document.currentScript.src gives us the URL this script was loaded from.
  // We use that to derive the API base (e.g. "https://ziyarn.vercel.app").
  // Falls back to location.origin if the script is injected dynamically
  // (e.g. via next/script afterInteractive, where currentScript may be null).
  // The data-api attribute on <zy-widget> overrides this entirely.
  var SCRIPT_SRC = document.currentScript && document.currentScript.src;