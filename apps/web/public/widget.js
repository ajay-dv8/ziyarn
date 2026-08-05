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
 */
(function () {
  "use strict";

  var SCRIPT_SRC = document.currentScript && document.currentScript.src;
  var DEFAULT_API_BASE = (function () {
    try {
      return new URL(SCRIPT_SRC, location.href).origin;
    } catch (_) {
      return location.origin;
    }
  })();

  var STYLE = `
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

    .zy-wrap {
      position: fixed;
      bottom: 20px;
      z-index: 2147483000;
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
    .zy-launcher .zy-close { display: none; }
    .zy-wrap[data-open="true"] .zy-launcher .zy-open { display: none; }
    .zy-wrap[data-open="true"] .zy-launcher .zy-close { display: block; }

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

    .zy-header {
      background: var(--zy-color);
      color: #fff;
      padding: 14px 16px;
      flex-shrink: 0;
    }
    .zy-header-title { font-weight: 650; font-size: 16px; letter-spacing: -0.01em; }
    .zy-header-sub { font-size: 12.5px; opacity: 0.92; margin-top: 2px; }
    .zy-header-status { display: none; margin-top: 6px; font-size: 12px; opacity: 0.95; }
    .zy-header-status[data-visible="true"] { display: flex; align-items: center; gap: 6px; }
    .zy-header-status::before {
      content: "";
      width: 7px; height: 7px; border-radius: 50%;
      background: currentColor; flex-shrink: 0;
      animation: zy-pulse 1.4s ease-in-out infinite;
    }

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
    .zy-msg {
      max-width: 84%;
      padding: 9px 13px;
      border-radius: 16px;
      font-size: 14.5px;
      white-space: pre-wrap;
      word-break: break-word;
      animation: zy-in 0.16s ease;
    }
    .zy-msg-agent { background: #fff; border: 1px solid var(--zy-border); border-bottom-left-radius: 5px; align-self: flex-start; }
    .zy-msg-owner { background: #fff; border: 1px solid var(--zy-color); border-bottom-left-radius: 5px; align-self: flex-start; }
    .zy-msg-owner::before { content: "Owner"; display: block; font-size: 11px; font-weight: 600; color: var(--zy-color); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
    .zy-msg-user { background: var(--zy-color); color: #fff; border-bottom-right-radius: 5px; align-self: flex-end; }
    .zy-msg-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; align-self: center; font-size: 13px; }
    .zy-msg-typing { color: var(--zy-muted); font-size: 13.5px; }
    .zy-msg-typing::after { content: "…"; animation: zy-dots 1.1s infinite; }

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

    .zy-note { padding: 0 16px 12px; font-size: 12px; color: var(--zy-muted); text-align: center; flex-shrink: 0; }

    @keyframes zy-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes zy-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @keyframes zy-dots { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }

    @media (max-width: 480px) {
      .zy-panel {
        width: 100vw;
        max-width: none;
        height: 100dvh;
        max-height: none;
        border-radius: 0;
        border: none;
      }
      .zy-wrap, .zy-wrap[data-position] { left: 0; right: 0; bottom: 0; }
      .zy-launcher { position: fixed; right: 16px; bottom: 16px; }
      .zy-wrap[data-position="bottom-left"] .zy-launcher { left: 16px; right: auto; }
    }
  `;

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  class ZyWidget extends HTMLElement {
    constructor() {
      super();
      this._open = false;
      this._streaming = false;
      this._apiBase = null;
      this._conversationId = null;
      this._visitorId = null;
      this._slug = "";
      this._secret = "";
      this._title = "Chat with us";
      this._subtitle = "We usually reply in minutes";
      this._color = "#10b981";
      this._position = "bottom-right";
    }

    connectedCallback() {
      if (this._rendered) return;
      this._rendered = true;

      this._slug = this.getAttribute("data-slug") || "";
      this._secret = this.getAttribute("data-secret") || "";
      this._title = this.getAttribute("data-title") || this._title;
      this._subtitle = this.getAttribute("data-subtitle") || this._subtitle;
      this._color = this.getAttribute("data-color") || this._color;
      this._position = this.getAttribute("data-position") || this._position;
      this._apiBase =
        this.getAttribute("data-api") || DEFAULT_API_BASE;

      if (!this._slug || !this._secret) {
        console.error(
          "[zy-widget] data-slug and data-secret attributes are required"
        );
        return;
      }

      var root = this.attachShadow({ mode: "open" });
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
        "</div>" +
        '<div class="zy-messages"></div>' +
        '<div class="zy-composer">' +
        '<input type="text" placeholder="Type a message…" autocomplete="off" />' +
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

      var wrap = root.querySelector(".zy-wrap");
      wrap.style.setProperty("--zy-color", this._color);

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
      this._titleEl.textContent = this._title;
      this._subEl.textContent = this._subtitle;
      this._sendBtn.disabled = false;

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
      this._conversationId = this._loadStore("conversation") || null;
      this._lastMsgAt = null;
      this._deltaActive = false;
      this._deltaTimer = null;

      this._launcher.addEventListener("click", this._toggle.bind(this));
      this._input.addEventListener("keydown", this._onKey.bind(this));
      this._sendBtn.addEventListener("click", this._send.bind(this));

      this._init();
    }

    _loadStore(key) {
      try {
        return localStorage.getItem("zy:" + key + ":" + this._slug);
      } catch (_) {
        return null;
      }
    }

    _saveStore(key, value) {
      try {
        localStorage.setItem("zy:" + key + ":" + this._slug, value);
      } catch (_) {
        /* private mode — ignore */
      }
    }

    _init() {
      var self = this;
      this._fetch(this._apiBase + "/api/chat", {
        method: "GET",
        headers: { "x-embed-secret": this._secret },
      })
        .then(function (data) {
          if (data && data.agent) {
            if (data.agent.name) self._titleEl.textContent = data.agent.name;
            if (data.agent.description)
              self._subEl.textContent = data.agent.description;
          }
        })
        .catch(function () {
          /* keep attribute defaults */
        });

      if (this._conversationId) {
        this._loadHistory();
      } else {
        this._appendMessage("agent", "Hi there! How can we help you today?");
      }
    }

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
            self._messages.textContent = "";
            var latest = null;
            data.messages.forEach(function (m) {
              if (m.sender === "owner") self._appendMessage("owner", m.content);
              else if (m.role === "user") self._appendMessage("user", m.content);
              else if (m.role === "assistant")
                self._appendMessage("agent", m.content);
              if (m.createdAt) latest = m.createdAt;
            });
            if (latest) {
              var t = Date.parse(latest);
              if (!isNaN(t)) self._lastMsgAt = new Date(t);
            }
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

    _toggle() {
      this._open = !this._open;
      this._wrap.setAttribute("data-open", String(this._open));
      this._launcher.setAttribute(
        "aria-label",
        this._open ? "Close chat" : "Open chat"
      );
      if (this._open) {
        this._messages.scrollTop = this._messages.scrollHeight;
        this._input.focus();
      }
    }

    _onKey(event) {
      if (event.key === "Enter" && !event.shiftKey && !this._streaming) {
        event.preventDefault();
        this._send();
      }
    }

    _appendMessage(kind, text) {
      var node = el("div", "zy-msg zy-msg-" + kind, text);
      this._messages.appendChild(node);
      this._scrollToBottom();
      return node;
    }

    _scrollToBottom() {
      this._messages.scrollTop = this._messages.scrollHeight;
    }

    _setStatus(text) {
      if (text) {
        this._statusEl.textContent = text;
        this._statusEl.setAttribute("data-visible", "true");
      } else {
        this._statusEl.textContent = "";
        this._statusEl.setAttribute("data-visible", "false");
      }
    }

    _send() {
      var text = this._input.value.trim();
      if (!text || this._streaming) return;

      this._input.value = "";
      this._appendMessage("user", text);
      this._streaming = true;
      this._sendBtn.disabled = true;
      var typing = this._appendMessage("agent", "typing");
      typing.classList.add("zy-msg-typing");

      var self = this;
      var body = JSON.stringify({
        message: text,
        visitorId: this._visitorId,
        conversationId: this._conversationId || undefined,
      });

      fetch(this._apiBase + "/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-embed-secret": this._secret,
        },
        body: body,
      })
        .then(function (response) {
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
          return response.body;
        })
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

    _readStream(stream, typingNode) {
      var self = this;
      var reader = stream.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      var reply = "";

      function handleEvent(data) {
        var event;
        try {
          event = JSON.parse(data);
        } catch (_) {
          return;
        }
        if (event.type === "text") {
          reply += event.delta || "";
          typingNode.classList.remove("zy-msg-typing");
          typingNode.textContent = reply;
          self._scrollToBottom();
        } else if (event.type === "escalate") {
          self._setStatus("Connecting you with a human…");
          typingNode.classList.remove("zy-msg-typing");
          typingNode.textContent =
            "I've asked a human teammate to take over — they'll join this chat shortly.";
          self._scrollToBottom();
          self._startDelta();
        } else if (event.type === "done") {
          if (event.conversationId) {
            self._conversationId = event.conversationId;
            self._saveStore("conversation", event.conversationId);
          }
          self._lastMsgAt = new Date(event.serverTime || Date.now());
          self._startDelta();
        } else if (event.type === "error") {
          typingNode.classList.remove("zy-msg-typing");
          typingNode.textContent = event.message || "Something went wrong";
        }
      }

      function pump(result) {
        if (result.done) return;
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

    /**
     * Realtime delta loop: holds an SSE stream to /api/chat?since&stream=1;
     * the server pushes new messages (owner replies) and closes; we
     * reconnect immediately. Runs while the widget exists.
     */
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
          self._scheduleDelta(2500);
        });
    }

    _scheduleDelta(delay) {
      var self = this;
      clearTimeout(this._deltaTimer);
      this._deltaTimer = setTimeout(function () {
        if (self._conversationId) self._startDelta();
      }, delay);
    }

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
          if (m.sender === "owner" && m.content) {
            self._appendMessage("owner", m.content);
          }
          if (m.createdAt) {
            var t = Date.parse(m.createdAt);
            if (!isNaN(t)) self._lastMsgAt = new Date(t);
          }
        } else if (event.type === "done") {
          self._deltaActive = false;
          if (event.serverTime) {
            var t = Date.parse(event.serverTime);
            if (!isNaN(t)) self._lastMsgAt = new Date(t);
          }
          self._scheduleDelta(200);
        } else if (event.type === "error") {
          self._deltaActive = false;
          self._scheduleDelta(2000);
        }
      }

      function pump(result) {
        if (result.done) {
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
