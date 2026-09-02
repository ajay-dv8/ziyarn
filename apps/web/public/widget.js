/* eslint-disable */
/*
 * Ziyarn widget — Shadow DOM web component (<zy-widget>).
 *
 * Usage:
 *   <script defer src="https://app.ziyarn.com/widget.js"></script>
 *   <zy-widget data-slug="acme" data-secret="..." data-title="Chat with us"></zy-widget>
 *
 * Attributes:
 *   data-slug    (required) domain slug
 *   data-secret  (required) domain embed secret
 *   data-title   header title            (default "Chat with us")
 *   data-subtitle header subtitle        (default "We usually reply in minutes")
 *   data-color   launcher/accent color   (default "#10b981")
 *   data-position "bottom-right" | "bottom-left" (default "bottom-right")
 *   data-api     API base URL override   (default: origin of this script)
 *
 * Works in browsers and WebViews (no iframe). Styling is fully encapsulated
 * in the shadow root, so host page CSS cannot leak in or out.
 *
 * Architecture overview:
 *   1. IIFE registers a <zy-widget> custom element via customElements.define()
 *   2. When the element enters the DOM, connectedCallback() fires:
 *      - Reads data-* attributes for config
 *      - Creates Shadow DOM (fully isolated styles + markup)
 *      - Generates a persistent visitor ID (localStorage)
 *      - Restores any in-progress conversation from localStorage
 *      - Wires up event listeners (launcher, send, keyboard, header close)
 *      - Calls _init() to fetch agent config and load history
 *   3. User messages are POSTed to /api/chat as SSE streams
 *   4. The widget reads the SSE stream incrementally, rendering tokens
 *      in real-time via renderMd() (lightweight markdown → HTML)
 *   5. After the AI responds, a delta loop polls for owner (human) replies
 *      via GET /api/chat?since=X&stream=1 (long-poll SSE)
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
  var DEFAULT_API_BASE = (function () {
    try {
      return new URL(SCRIPT_SRC, location.href).origin;
    } catch (_) {
      return location.origin;
    }
  })();

  // ---------------------------------------------------------------------------
  // Styles — injected as a <style> tag inside the Shadow DOM
  // ---------------------------------------------------------------------------
  // All styles are scoped to the shadow root. The host page's CSS cannot leak
  // in, and these styles cannot leak out. CSS custom properties (--zy-*) are
  // used so the host page can override colors via the element's attributes.
  //
  // :host targets the <zy-widget> element itself. `all: initial` resets every
  // inherited property so the host page's fonts/colors don't bleed in.
  //
  // Layout structure inside the shadow DOM:
  //   .zy-wrap (fixed-position wrapper)
  //     .zy-panel (the chat window — hidden until data-open="true")
  //       .zy-header (title, subtitle, status indicator, mobile close btn)
  //       .zy-messages (scrollable message list)
  //       .zy-composer (text input + send button)
  //       .zy-note ("Powered by Ziyarn" footer)
  //     .zy-launcher (the floating circle button — toggles the panel)
  var STYLE = `
    /* ---- Reset & base ---- */
    :host {
      --zy-color: var(--zy-color, #10b981);
      --zy-text: var(--zy-text, #0f172a);
      --zy-muted: var(--zy-muted, #64748b);
      --zy-bg: var(--zy-bg, #ffffff);
      --zy-border: var(--zy-border, #e2e8f0);
      --zy-radius: 14px;
      --zy-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
      all: initial;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ---- Fixed-position wrapper — anchors the panel and launcher to viewport ---- */
    .zy-wrap {
      position: fixed;
      bottom: 20px;
      z-index: 2147483000; /* above everything, including site z-index stacks */
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
      font-size: 15px;
      line-height: 1.45;
      color: var(--zy-text);
    }
    .zy-wrap[data-position="bottom-left"] { left: 20px; right: auto; align-items: flex-start; }
    .zy-wrap[data-position="bottom-right"] { right: 20px; left: auto; }

    /* ---- Launcher — the floating chat bubble that toggles the panel open/closed ---- */
    .zy-launcher {
      width: 58px;
      height: 58px;
      border: none;
      border-radius: 50%;
      background: var(--zy-color);
      color: #fff;
      cursor: pointer;
      box-shadow: var(--zy-shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .zy-launcher:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 16px 44px rgba(15, 23, 42, 0.24); }
    .zy-launcher svg { width: 26px; height: 26px; }
    /* Toggle between chat icon and close icon based on data-open */
    .zy-launcher .zy-close { display: none; }
    .zy-wrap[data-open="true"] .zy-launcher .zy-open { display: none; }
    .zy-wrap[data-open="true"] .zy-launcher .zy-close { display: block; }

    /* ---- Chat panel — the main chat window ---- */
    /* Hidden by default (display: none). Shown when data-open="true" on .zy-wrap. */
    .zy-panel {
      width: 382px;
      max-width: calc(100vw - 32px);
      height: 620px;
      max-height: min(80vh, 700px);
      background: var(--zy-bg);
      border: 1px solid var(--zy-border);
      border-radius: var(--zy-radius);
      box-shadow: var(--zy-shadow);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }
    .zy-wrap[data-open="true"] .zy-panel { display: flex; }

    /* ---- Header — agent name, description, online status, mobile close button ---- */
    .zy-header {
      background: var(--zy-color);
      color: #fff;
      padding: 14px 16px;
      flex-shrink: 0;
      position: relative; /* anchor for the absolute-positioned close button */
    }
    .zy-header-title { font-weight: 650; font-size: 16px; letter-spacing: -0.01em; padding-right: 36px; /* room for close btn */ }
    .zy-header-sub { font-size: 12.5px; opacity: 0.92; margin-top: 2px; }
    /* Close button inside the header — hidden on desktop, shown on mobile (≤480px) */
    .zy-header-close {
      display: none;
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      line-height: 0;
      transition: background 0.15s ease;
    }
    .zy-header-close:hover { background: rgba(255,255,255,0.18); }
    .zy-header-close svg { width: 20px; height: 20px; }
    /* Online status indicator — pulsing dot shown during escalated conversations */
    .zy-header-status { display: none; margin-top: 6px; font-size: 12px; opacity: 0.95; }
    .zy-header-status[data-visible="true"] { display: flex; align-items: center; gap: 6px; }
    .zy-header-status::before {
      content: "";
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor; flex-shrink: 0;
      animation: zy-pulse 1.4s ease-in-out infinite;
    }

    /* ---- Messages container — scrollable list of chat bubbles ---- */
    /* overscroll-behavior: contain prevents the page from scrolling when
       the user scrolls to the top/bottom of the message list (important
       on mobile where the panel is fullscreen). */
    .zy-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
      overscroll-behavior: contain;
    }
    /* Individual message bubble styles */
    .zy-msg {
      max-width: 84%;
      padding: 9px 13px;
      border-radius: 16px;
      font-size: 14.5px;
      white-space: pre-wrap;
      word-break: break-word;
      animation: zy-in 0.16s ease;
    }
    /* Agent (AI) messages — left-aligned, white background */
    .zy-msg-agent { background: #fff; border: 1px solid var(--zy-border); border-bottom-left-radius: 5px; align-self: flex-start; }
    /* Owner (human support) messages — left-aligned, accent border, labeled */
    .zy-msg-owner { background: #fff; border: 1px solid var(--zy-color); border-bottom-left-radius: 5px; align-self: flex-start; }
    .zy-msg-owner::before { content: "Owner"; display: block; font-size: 11px; font-weight: 600; color: var(--zy-color); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
    /* User (visitor) messages — right-aligned, accent background, white text */
    .zy-msg-user { background: var(--zy-color); color: #fff; border-bottom-right-radius: 5px; align-self: flex-end; }
    /* Error messages — centered, red background */
    .zy-msg-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; align-self: center; font-size: 13px; }
    /* Typing indicator — bouncing dots while waiting for AI response */
    .zy-msg-typing { padding: 9px 13px; }
    .zy-typing-dots { display: inline-flex; align-items: center; gap: 12%; }
    .zy-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--zy-color);
      animation: zy-bounce 1.4s ease-in-out infinite;
    }
    .zy-dot:nth-child(2) { animation-delay: 0.2s; }
    .zy-dot:nth-child(3) { animation-delay: 0.4s; }

    /* ---- Composer — input field + send button at the bottom of the panel ---- */
    .zy-composer {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid var(--zy-border);
      background: #fff;
      flex-shrink: 0;
    }
    .zy-composer input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--zy-border);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14.5px;
      font-family: inherit;
      color: var(--zy-text);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .zy-composer input:focus { border-color: var(--zy-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--zy-color) 22%, transparent); }
    .zy-composer input::placeholder { color: var(--zy-muted); }
    .zy-composer button {
      border: none;
      border-radius: 10px;
      background: var(--zy-color);
      color: #fff;
      width: 42px;
      flex-shrink: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .zy-composer button:hover:not(:disabled) { transform: translateY(-1px); }
    .zy-composer button:disabled { opacity: 0.45; cursor: not-allowed; }
    .zy-composer button svg { width: 18px; height: 18px; }

    /* ---- Footer note ---- */
    .zy-note { padding: 0 16px 12px; font-size: 12px; color: var(--zy-muted); text-align: center; flex-shrink: 0; background: #fff; border-top: 1px solid var(--zy-border); }

    /* ---- Animations ---- */
    @keyframes zy-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes zy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes zy-bounce { 0%, 100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 1; } }

    /* ---- Mobile: fullscreen panel (≤480px) ---- */
    @media (max-width: 480px) {
      .zy-panel {
        width: 100vw;
        max-width: none;
        height: 100dvh; /* dynamic viewport height — handles mobile browser chrome */
        max-height: none;
        border-radius: 0;
        border: none;
      }
      .zy-wrap, .zy-wrap[data-position] { left: 0; right: 0; bottom: 0; }
      /* Keep the launcher as a floating bubble at the bottom */
      .zy-launcher { position: fixed; right: 16px; bottom: 16px; }
      .zy-wrap[data-position="bottom-left"] .zy-launcher { left: 16px; right: auto; }
      /* When panel is open on mobile: hide the floating launcher (it would overlap
         the send button), show the header close button instead */
      .zy-wrap[data-open="true"] .zy-launcher { display: none; }
      .zy-header-close { display: flex; }
    }
  `;

  // ---------------------------------------------------------------------------
  // SVG icons — inline, no external dependencies
  // ---------------------------------------------------------------------------
  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  };

  // ---------------------------------------------------------------------------
  // Helper: create a DOM element with optional className and text
  // ---------------------------------------------------------------------------
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
  // entirely within the Shadow DOM — no global variables or window pollution.
  class ZyWidget extends HTMLElement {
    constructor() {
      super();
      // ---- State ----
      this._open = false;            // whether the chat panel is visible
      this._streaming = false;       // true while an AI response is being streamed in
      this._apiBase = null;          // API base URL (e.g. "https://ziyarn.vercel.app")
      this._conversationId = null;   // current conversation ID (persisted in localStorage)
      this._visitorId = null;        // unique visitor ID (persisted in localStorage)
      // ---- Config (from data-* attributes) ----
      this._slug = "";               // domain slug — identifies which business/agent to talk to
      this._secret = "";             // embed secret — authenticates widget requests
      this._title = "Chat with us";  // header title (overridden by agent name after _init)
      this._subtitle = "We usually reply in minutes"; // header subtitle
      this._color = "#10b981";       // accent color for launcher, header, user messages
      this._position = "bottom-right"; // "bottom-right" or "bottom-left"
    }

    // -------------------------------------------------------------------------
    // connectedCallback — called when <zy-widget> is inserted into the DOM
    // -------------------------------------------------------------------------
    // This is the main initialization entry point. It:
    //   1. Reads data-* attributes
    //   2. Creates the Shadow DOM (isolated styles + markup)
    //   3. Caches references to key DOM elements for fast access
    //   4. Restores visitor ID and conversation from localStorage
    //   5. Wires up event listeners
    //   6. Calls _init() to fetch agent config and load conversation history
    connectedCallback() {
      if (this._rendered) return; // prevent double-init (e.g. React re-renders)
      this._rendered = true;

      // ---- Read configuration from data-* attributes ----
      this._slug = this.getAttribute("data-slug") || "";
      this._secret = this.getAttribute("data-secret") || "";
      this._title = this.getAttribute("data-title") || this._title;
      this._subtitle = this.getAttribute("data-subtitle") || this._subtitle;
      this._color = this.getAttribute("data-color") || this._color;
      this._position = this.getAttribute("data-position") || this._position;
      this._apiBase =
        this.getAttribute("data-api") || DEFAULT_API_BASE;

      // ---- Validate required attributes ----
      if (!this._slug || !this._secret) {
        console.error(
          "[zy-widget] data-slug and data-secret attributes are required"
        );
        return;
      }

      // ---- Create Shadow DOM ----
      // The shadow root encapsulates all styles and markup. The host page
      // cannot access or style elements inside the shadow root.
      var root = this.attachShadow({ mode: "open" });

      // ---- Build the DOM tree ----
      // Structure:
      //   <div class="zy-wrap">          — fixed-position wrapper
      //     <div class="zy-panel">       — chat window (hidden until open)
      //       <div class="zy-header">    — title bar with close button
      //       <div class="zy-messages">  — scrollable message list
      //       <div class="zy-composer">  — input + send button
      //       <div class="zy-note">      — "Powered by Ziyarn"
      //     <button class="zy-launcher"> — floating chat bubble
      root.innerHTML =
        "<style>" +
        STYLE +
        "</style>" +
        '<div class="zy-wrap" data-position="' +
        this._position +
        '">' +
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
        '<div class="zy-composer">' +
        '<input type="text" placeholder="Type a message\u2026" autocomplete="off" />' +
        '<button type="button" aria-label="Send message">' +
        ICONS.send +
        "</button>" +
        "</div>" +
        '<div class="zy-note">Powered by Ziyarn</div>' +
        "</div>" +
        '<button type="button" class="zy-launcher" aria-label="Open chat">' +
        '<span class="zy-open">' +
        ICONS.chat +
        "</span><span class=\"zy-close\">" +
        ICONS.close +
        "</span>" +
        "</button>" +
        "</div>";

      // ---- Apply accent color via CSS custom property ----
      var wrap = root.querySelector(".zy-wrap");
      wrap.style.setProperty("--zy-color", this._color);

      // ---- Cache DOM references for fast access ----
      // Avoids repeated querySelector calls during streaming/interaction.
      this._root = root;
      this._wrap = wrap;
      this._panel = root.querySelector(".zy-panel");
      this._launcher = root.querySelector(".zy-launcher");
      this._messages = root.querySelector(".zy-messages");
      this._input = root.querySelector(".zy-composer input");
      this._sendBtn = root.querySelector(".zy-composer button");
      this._titleEl = root.querySelector(".zy-header-title");
      this._subEl = root.querySelector(".zy-header-sub");
      this._statusEl = root.querySelector(".zy-header-status");
      this._headerCloseBtn = root.querySelector(".zy-header-close");
      this._titleEl.textContent = this._title;
      this._subEl.textContent = this._subtitle;
      this._sendBtn.disabled = false;

      // ---- Restore visitor ID from localStorage ----
      // The visitor ID persists across page reloads so the backend can track
      // conversation history per visitor. Generated via crypto.randomUUID()
      // with a fallback for older browsers/private mode.
      this._visitorId = this._loadStore("visitor");
      if (!this._visitorId) {
        this._visitorId =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "v-" +
              Math.random().toString(36).slice(2) +
              Date.now().toString(36);
        this._saveStore("visitor", this._visitorId);
      }

      // ---- Restore in-progress conversation from localStorage ----
      this._conversationId = this._loadStore("conversation") || null;
      this._lastMsgAt = null;      // timestamp of last message (for delta polling)
      this._deltaActive = false;   // true while the delta SSE loop is running
      this._deltaTimer = null;     // setTimeout ID for reconnecting the delta loop

      // ---- Wire up event listeners ----
      this._launcher.addEventListener("click", this._toggle.bind(this));
      this._headerCloseBtn.addEventListener("click", this._toggle.bind(this));
      this._input.addEventListener("keydown", this._onKey.bind(this));
      this._sendBtn.addEventListener("click", this._send.bind(this));

      // ---- Bootstrap: fetch agent info + load conversation history ----
      this._init();
    }

    // -------------------------------------------------------------------------
    // localStorage helpers — persist visitor ID and conversation ID
    // -------------------------------------------------------------------------
    // Keys are namespaced with the domain slug so multiple widgets on the
    // same page (different domains) don't collide.
    _loadStore(key) {
      try {
        return localStorage.getItem("zy:" + key + ":" + this._slug);
      } catch (_) {
        return null; // private browsing or storage full
      }
    }

    _saveStore(key, value) {
      try {
        localStorage.setItem("zy:" + key + ":" + this._slug, value);
      } catch (_) {
        /* private mode — ignore */
      }
    }

    // -------------------------------------------------------------------------
    // _init — bootstrap the widget after DOM is ready
    // -------------------------------------------------------------------------
    // Two things happen:
    //   1. GET /api/chat → fetches the agent's name and description to
    //      populate the header. This also validates the embed secret.
    //   2. If there's a saved conversation, load its history. Otherwise,
    //      show the default greeting message.
    _init() {
      var self = this;
      this._fetch(this._apiBase + "/api/chat", {
        method: "GET",
        headers: { "x-embed-secret": this._secret },
      })
        .then(function (data) {
          // Update header with the agent's actual name and description
          if (data && data.agent) {
            if (data.agent.name) self._titleEl.textContent = data.agent.name;
            if (data.agent.description)
              self._subEl.textContent = data.agent.description;
          }
        })
        .catch(function () {
          /* keep attribute defaults — API might be unreachable */
        });

      // If we have a saved conversation ID, load its message history.
      // Otherwise, show the default greeting.
      if (this._conversationId) {
        this._loadHistory();
      } else {
        this._appendMessage("agent", "Hi there! How can we help you today?");
      }
    }

    // -------------------------------------------------------------------------
    // _loadHistory — fetch and render previous messages for an existing conversation
    // -------------------------------------------------------------------------
    // Called when a conversation ID is found in localStorage (visitor returned
    // to the page). Renders all messages in chronological order and resumes
    // the delta loop if the conversation was escalated to a human agent.
    _loadHistory() {
      var self = this;
      var url =
        this._apiBase +
        "/api/chat?conversationId=" +
        encodeURIComponent(this._conversationId);
      this._fetch(url, {
        method: "GET",
        headers: { "x-embed-secret": this._secret },
      })
        .then(function (data) {
          if (data && Array.isArray(data.messages)) {
            self._messages.textContent = ""; // clear greeting
            var latest = null;
            data.messages.forEach(function (m) {
              // Route each message to the correct visual style:
              //   "owner" = human support agent (green border, labeled "Owner")
              //   "user"  = visitor (accent-colored bubble, right-aligned)
              //   "assistant" = AI agent (white bubble, left-aligned)
              if (m.sender === "owner") self._appendMessage("owner", m.content);
              else if (m.role === "user") self._appendMessage("user", m.content);
              else if (m.role === "assistant")
                self._appendMessage("agent", m.content);
              if (m.createdAt) latest = m.createdAt;
            });
            // Track the latest message timestamp for delta polling
            if (latest) {
              var t = Date.parse(latest);
              if (!isNaN(t)) self._lastMsgAt = new Date(t);
            }
            // If the conversation was escalated, start listening for human replies
            if (
              data.conversation &&
              data.conversation.status === "escalated"
            ) {
              self._startDelta();
            }
          }
        })
        .catch(function () {
          self._appendMessage("agent", "Hi there! How can we help you today?");
        });
    }

    // -------------------------------------------------------------------------
    // _toggle — open/close the chat panel
    // -------------------------------------------------------------------------
    // Toggles the data-open attribute on .zy-wrap, which CSS uses to show/hide
    // the panel and swap the launcher icon between chat/close.
    _toggle() {
      this._open = !this._open;
      this._wrap.setAttribute("data-open", String(this._open));
      this._launcher.setAttribute(
        "aria-label",
        this._open ? "Close chat" : "Open chat"
      );
      if (this._open) {
        // Scroll to the latest message and focus the input
        this._messages.scrollTop = this._messages.scrollHeight;
        this._input.focus();
      }
    }

    // -------------------------------------------------------------------------
    // _onKey — handle keyboard input in the text field
    // -------------------------------------------------------------------------
    // Enter sends the message (unless Shift is held for a newline).
    // Only sends when not currently streaming an AI response.
    _onKey(event) {
      if (event.key === "Enter" && !event.shiftKey && !this._streaming) {
        event.preventDefault();
        this._send();
      }
    }

    // -------------------------------------------------------------------------
    // _appendMessage — add a chat bubble to the message list
    // -------------------------------------------------------------------------
    // kind: "agent" | "user" | "owner" | "error"
    //   - "agent" messages are rendered through renderMd() (supports bold,
    //     italic, code, line breaks). This is safe because renderMd() escapes
    //     HTML first, then applies only controlled formatting tags.
    //   - "user" and "owner" messages use textContent (plain text only).
    //
    // Returns the created DOM node so callers can modify it later
    // (e.g. streaming updates to the typing indicator).
    _appendMessage(kind, text) {
      var node = document.createElement("div");
      node.className = "zy-msg zy-msg-" + kind;
      if (kind === "agent") {
        node.innerHTML = renderMd(text);
      } else {
        node.textContent = text;
      }
      this._messages.appendChild(node);
      this._scrollToBottom();
      return node;
    }

    _scrollToBottom() {
      this._messages.scrollTop = this._messages.scrollHeight;
    }

    // -------------------------------------------------------------------------
    // _setStatus — show/hide the status indicator in the header
    // -------------------------------------------------------------------------
    // Used during escalation to show "Connecting you with a human..."
    // with a pulsing green dot.
    _setStatus(text) {
      if (text) {
        this._statusEl.textContent = text;
        this._statusEl.setAttribute("data-visible", "true");
      } else {
        this._statusEl.textContent = "";
        this._statusEl.setAttribute("data-visible", "false");
      }
    }

    // -------------------------------------------------------------------------
    // _send — send a user message to the AI
    // -------------------------------------------------------------------------
    // Flow:
    //   1. Add the user's message to the chat UI
    //   2. Add a "typing" indicator placeholder
    //   3. POST /api/chat with the message, visitor ID, and conversation ID
    //   4. The response is an SSE stream — read it incrementally via _readStream()
    //   5. On error, show an error message in the typing bubble
    //   6. On completion, re-enable the input and focus it
    //
    // The server streams SSE events:
    //   data: {"type":"text","delta":"Hello"}      — incremental AI text
    //   data: {"type":"escalate"}                   — handoff to human
    //   data: {"type":"done","conversationId":"x"}  — response complete
    //   data: {"type":"error","message":"..."}      — error occurred
    _send() {
      var text = this._input.value.trim();
      if (!text || this._streaming) return;

      this._input.value = "";
      this._appendMessage("user", text);
      this._streaming = true;
      this._sendBtn.disabled = true;
      // Create a "typing" bubble with bouncing dots, updated as tokens stream in
      var typing = this._appendMessage("agent", "");
      typing.classList.add("zy-msg-typing");
      typing.innerHTML = '<span class="zy-typing-dots"><span class="zy-dot"></span><span class="zy-dot"></span><span class="zy-dot"></span></span>';
      // Track when typing started so we can enforce a minimum display time
      this._typingStartedAt = Date.now();
      this._typingMinimumMs = 600;

      var self = this;
      var payload = {
        message: text,
        visitorId: this._visitorId,
        conversationId: this._conversationId || undefined,
      };

      function doFetch(body) {
        return fetch(self._apiBase + "/api/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-embed-secret": self._secret,
          },
          body: JSON.stringify(body),
        }).then(function (response) {
          if (!response.ok) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (data) {
                var err = data && data.error;
                var msg =
                  err && err.message
                    ? err.message
                    : "Request failed (" + response.status + ")";
                var code = err && err.code;
                // Stale conversation — clear it and retry as a new conversation
                if (code === "NOT_FOUND" && self._conversationId) {
                  self._conversationId = null;
                  self._saveStore("conversation", "");
                  var retry = {
                    message: text,
                    visitorId: self._visitorId,
                  };
                  return doFetch(retry);
                }
                throw new Error(msg);
              });
          }
          return response.body;
        });
      }

      doFetch(payload)
        .then(function (bodyStream) {
          if (!bodyStream) return Promise.resolve();
          return self._readStream(bodyStream, typing);
        })
        .catch(function (error) {
          typing.classList.remove("zy-msg-typing");
          typing.classList.add("zy-msg-error");
          typing.textContent =
            error.message || "Something went wrong";
        })
        .finally(function () {
          self._streaming = false;
          self._sendBtn.disabled = false;
          self._input.focus();
        });
    }

    // -------------------------------------------------------------------------
    // _readStream — consume the SSE stream from /api/chat and render tokens
    // -------------------------------------------------------------------------
    // The server sends Server-Sent Events (SSE) as:
    //   data: {JSON}\n\n
    //
    // The reader accumulates chunks in a buffer, splits on "\n\n" boundaries,
    // and processes each complete event. The "text" events append to the
    // `reply` string and re-render the typing bubble with renderMd().
    //
    // After "done", the conversation ID is saved and the delta loop starts
    // (to listen for human agent replies).
    _readStream(stream, typingNode) {
      var self = this;
      var reader = stream.getReader();
      var decoder = new TextDecoder();
      var buffer = "";  // partial SSE data that hasn't been fully received yet
      var reply = "";   // accumulated AI response text
      var typingRevealed = false; // true once the typing indicator has been replaced
      var typingTimer = null;    // setTimeout ID for delayed typing reveal

      function cancelTypingTimer() {
        if (typingTimer) {
          clearTimeout(typingTimer);
          typingTimer = null;
        }
      }

      var STREAM_TIMEOUT_MS = 90000;
      var inactivityTimer = null;

      function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(function () {
          reader.cancel();
          cancelTypingTimer();
          typingNode.classList.remove("zy-msg-typing");
          typingNode.classList.add("zy-msg-error");
          typingNode.textContent = "Response timed out. Please try again.";
        }, STREAM_TIMEOUT_MS);
      }

      function handleEvent(data) {
        resetInactivityTimer();
        var event;
        try {
          event = JSON.parse(data);
        } catch (_) {
          return; // ignore malformed events
        }
        if (event.type === "text") {
          // Incremental text token — append and re-render
          reply += event.delta || "";
          function renderReply() {
            typingNode.classList.remove("zy-msg-typing");
            typingNode.innerHTML = renderMd(reply);
            self._scrollToBottom();
          }
          if (typingRevealed) {
            // Minimum time already enforced — render immediately
            renderReply();
          } else {
            // First text token — enforce minimum typing display time
            typingRevealed = true;
            var elapsed = Date.now() - self._typingStartedAt;
            var remaining = self._typingMinimumMs - elapsed;
            if (remaining > 0) {
              typingTimer = setTimeout(renderReply, remaining);
            } else {
              renderReply();
            }
          }
        } else if (event.type === "escalate") {
          cancelTypingTimer();
          // AI decided to hand off to a human agent
          self._setStatus("Connecting you with a human...");
          typingNode.classList.remove("zy-msg-typing");
          typingNode.textContent =
            "I've asked a human teammate to take over - they'll join this chat shortly.";
          self._scrollToBottom();
          self._startDelta(); // start listening for human replies
        } else if (event.type === "done") {
          // Response complete — save conversation ID and start delta loop
          if (event.conversationId) {
            self._conversationId = event.conversationId;
            self._saveStore("conversation", event.conversationId);
          }
          self._lastMsgAt = new Date(event.serverTime || Date.now());
          self._startDelta();
        } else if (event.type === "error") {
          cancelTypingTimer();
          typingNode.classList.remove("zy-msg-typing");
          typingNode.textContent = event.message || "Something went wrong";
        }
      }

      // pump() reads chunks from the stream, splits on SSE boundaries,
      // and processes complete events. The leftover partial data stays
      // in `buffer` for the next iteration.
      function pump(result) {
        if (result.done) {
          clearTimeout(inactivityTimer);
          return;
        }
        resetInactivityTimer();
        buffer += decoder.decode(result.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop(); // last element may be incomplete
        parts.forEach(function (chunk) {
          var line = chunk.split("\n")[0];
          if (line.indexOf("data:") === 0) {
            handleEvent(line.slice(5).trim());
          }
        });
        return reader.read().then(pump);
      }

      resetInactivityTimer();
      return reader.read().then(pump);
    }

    // -------------------------------------------------------------------------
    // _fetch — wrapper around fetch() that throws on non-2xx responses
    // -------------------------------------------------------------------------
    // Parses the error body as JSON to extract the error message, falling
    // back to a generic message if parsing fails.
    _fetch(url, options) {
      return fetch(url, options).then(function (response) {
        if (!response.ok) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (payload) {
              var err = payload && payload.error;
              throw new Error(
                err && err.message
                  ? err.message
                  : "Request failed (" + response.status + ")"
              );
            });
        }
        return response.json();
      });
    }

    // -------------------------------------------------------------------------
    // Delta loop — realtime polling for owner (human) replies
    // -------------------------------------------------------------------------
    // After an AI response completes (or the conversation is escalated),
    // the widget holds an SSE connection to:
    //   GET /api/chat?conversationId=X&since=Y&stream=1
    //
    // The server long-polls Postgres for new owner messages, pushes them
    // as SSE events, and closes the connection. The widget reconnects
    // immediately with an updated `since` timestamp.
    //
    // This gives near-realtime updates without WebSockets.
    //
    // Events received:
    //   {"type":"message","message":{...}} — new owner message
    //   {"type":"done","serverTime":"..."} — server closed, reconnect
    //   {"type":"error"}                   — error, retry after delay
    _startDelta() {
      var self = this;
      if (this._deltaActive || !this._conversationId || !this._lastMsgAt) {
        return;
      }
      this._deltaActive = true;
      var url =
        this._apiBase +
        "/api/chat?conversationId=" +
        encodeURIComponent(this._conversationId) +
        "&since=" +
        encodeURIComponent(this._lastMsgAt.toISOString()) +
        "&stream=1";
      fetch(url, {
        method: "GET",
        headers: { "x-embed-secret": this._secret },
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("delta request failed (" + response.status + ")");
          }
          return self._readDelta(response.body);
        })
        .catch(function () {
          self._deltaActive = false;
          self._scheduleDelta(2500); // retry after 2.5s on error
        });
    }

    _scheduleDelta(delay) {
      var self = this;
      clearTimeout(this._deltaTimer);
      this._deltaTimer = setTimeout(function () {
        if (self._conversationId) self._startDelta();
      }, delay);
    }

    // -------------------------------------------------------------------------
    // _readDelta — consume the SSE stream for realtime owner replies
    // -------------------------------------------------------------------------
    // Same SSE parsing pattern as _readStream(), but for a different event
    // shape. The delta stream only carries "message", "done", and "error"
    // events (no "text" tokens).
    _readDelta(stream) {
      var self = this;
      var reader = stream.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      function handleEvent(data) {
        var event;
        try {
          event = JSON.parse(data);
        } catch (_) {
          return;
        }
        if (event.type === "message" && event.message) {
          var m = event.message;
          // Only render owner messages (human support agent replies)
          if (m.sender === "owner" && m.content) {
            self._appendMessage("owner", m.content);
          }
          if (m.createdAt) {
            var t = Date.parse(m.createdAt);
            if (!isNaN(t)) self._lastMsgAt = new Date(t);
          }
        } else if (event.type === "done") {
          // Server closed the connection — reconnect quickly
          self._deltaActive = false;
          if (event.serverTime) {
            var t = Date.parse(event.serverTime);
            if (!isNaN(t)) self._lastMsgAt = new Date(t);
          }
          self._scheduleDelta(200);
        } else if (event.type === "error") {
          // Error — back off and retry
          self._deltaActive = false;
          self._scheduleDelta(2000);
        }
      }

      function pump(result) {
        if (result.done) {
          // Stream ended unexpectedly — reconnect
          self._deltaActive = false;
          self._scheduleDelta(200);
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        parts.forEach(function (chunk) {
          var line = chunk.split("\n")[0];
          if (line.indexOf("data:") === 0) {
            handleEvent(line.slice(5).trim());
          }
        });
        return reader.read().then(pump);
      }

      return reader.read().then(pump);
    }
  }

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
})();
