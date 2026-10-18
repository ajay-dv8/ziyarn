  class ZyWidget extends HTMLElement {
    constructor() {
      super();
      // ---- State ----
      this._open = false;            // whether the chat panel is visible
      this._streaming = false;       // true while an AI response is being streamed in
      this._thinking = null;          // active variant thinking controller, or null
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

      // ---- Resolve which look to render ----
      // Fail-open: unknown or missing values fall back to classic, because
      // every widget embedded before variants existed has no data-variant.
      this._variant = resolveVariant(this.getAttribute("data-variant"));
      var variant = this._variant;

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

      // ---- Build the DOM tree from the resolved variant ----
      // Structure (class names are the engine contract — see VARIANTS above):
      //   <div class="zy-wrap">          — fixed-position wrapper
      //     <div class="zy-panel">       — chat window (hidden until open)
      //       <div class="zy-header">    — title bar with close button
      //       <div class="zy-messages">  — scrollable message list
      //       <div class="zy-composer">  — input + send button
      //       <div class="zy-note">      — "Powered by Ziyarn"
      //     <button class="zy-launcher"> — floating chat bubble
      root.innerHTML =
        "<style>" +
        BASE_CSS +
        (variant.css || "") +
        "</style>" +
        variant.markup({
          title: this._title,
          subtitle: this._subtitle,
          color: this._color,
          position: this._position,
        });

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
      // Select by explicit class, NOT ".zy-composer button" — a positional
      // selector would bind _sendBtn to whatever button comes first.
      this._sendBtn = root.querySelector(".zy-composer .zy-send");
      this._composer = root.querySelector(".zy-composer");
      this._placeholder = root.querySelector(".zy-composer-ph");
      // Whether the visitor is in the field right now. Tracked here because
      // the input is inside a shadow root (see _syncPlaceholder).
      this._inputEngaged = false;
      this._placeholders = [
        "How can I help you today?",
        "What are your opening hours?",
      ];
      this._placeholderIndex = 0;
      this._placeholderTimer = null;
      this._renderPlaceholder();
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
      this._input.addEventListener("input", this._onInput.bind(this));
      this._input.addEventListener("focus", this._onFocus.bind(this));
      this._sendBtn.addEventListener("click", this._send.bind(this));
      this._input.addEventListener("blur", this._onBlur.bind(this));
      this._startPlaceholderCycle();

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
    //      populate the header, plus the business-type placeholder prompts.
    //      This also validates the embed secret.
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
          // Composer capabilities. Both are optional so an older backend that
          // does not return them simply leaves the defaults in place.
          if (data && data.placeholders) {
            self._setPlaceholders(data.placeholders);
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
      this._syncExpanded();
    }

    // -------------------------------------------------------------------------
    // _syncExpanded — expand the composer while focused or non-empty.
    //
    // The composer grows once the visitor is engaged, and collapses again when
    // the field is blurred and emptied.
    // -------------------------------------------------------------------------
    _syncExpanded() {
      var expanded = this._streaming || Boolean(this._input.value);
      this._composer.setAttribute("data-expanded", String(expanded));
    }

    // -------------------------------------------------------------------------
    // _setPlaceholders — adopt the prompts the server chose for this business
    // type. Called from _init(); falls back to the generic list above.
    // -------------------------------------------------------------------------
    _setPlaceholders(list) {
      if (!Array.isArray(list) || !list.length) return;
      var cleaned = list
        .filter(function (item) { return typeof item === "string"; })
        .map(function (item) { return item.slice(0, 60); })
        .filter(function (item) { return item.length > 0; });
      if (!cleaned.length) return;
      this._placeholders = cleaned;
      this._placeholderIndex = 0;
      this._renderPlaceholder();
    }

    // -------------------------------------------------------------------------
    // _renderPlaceholder — draw the rotating hint under the input.
    //
    // Each character is its own span carrying a staggered animation-delay, so
    // the blur-in cascade is pure CSS. Rebuilt only when the text changes or the
    // visitor starts typing — never per keystroke.
    // -------------------------------------------------------------------------
    _renderPlaceholder() {
      if (!this._placeholder) return;
      var text = this._placeholders[this._placeholderIndex] || "";
      var html = "";
      for (var charIndex = 0; charIndex < text.length; charIndex += 1) {
        var character = text.charAt(charIndex);
        html +=
          '<span style="--zy-ph-delay:' +
          charIndex * 22 +
          'ms">' +
          (character === " " ? "&nbsp;" : this._escapeHtml(character)) +
          "</span>";
      }
      this._placeholder.innerHTML = html;
      this._placeholder.removeAttribute("data-leaving");
    }

    _escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // -------------------------------------------------------------------------
    // _startPlaceholderCycle — rotate the hint every few seconds while idle.
    // Cleared the moment the visitor types, so their draft is never disturbed.
    // -------------------------------------------------------------------------
    _startPlaceholderCycle() {
      var self = this;
      this._stopPlaceholderCycle();
      if (this._placeholders.length < 2) return;
      this._placeholderTimer = setInterval(function () {
        if (self._input.value || self._streaming) return;
        // Fade the old phrase out before swapping, so the change reads as
        // intentional rather than a flicker.
        if (self._placeholder) {
          self._placeholder.setAttribute("data-leaving", "true");
        }
        setTimeout(function () {
          self._placeholderIndex =
            (self._placeholderIndex + 1) % self._placeholders.length;
          self._renderPlaceholder();
        }, 320);
      }, 4200);
    }

    _stopPlaceholderCycle() {
      if (this._placeholderTimer) {
        clearInterval(this._placeholderTimer);
        this._placeholderTimer = null;
      }
    }

    // -------------------------------------------------------------------------
    // _onFocus / _onInput — expand the composer and park the hint while typing
    // -------------------------------------------------------------------------
    _onFocus() {
      this._inputEngaged = true;
      this._syncExpanded();
      this._syncPlaceholder();
    }

    _onBlur() {
      this._inputEngaged = false;
      this._syncExpanded();
      this._syncPlaceholder();
    }

    _onInput() {
      this._syncExpanded();
      this._syncPlaceholder();
    }

    // -------------------------------------------------------------------------
    // _syncPlaceholder — hide the hint while the visitor is typing or focused.
    //
    // The hint is drawn under the input, so leaving it up while there is text
    // makes the two overlap and the field unreadable. Once the visitor focuses
    // the field they already know what it is for, so the hint goes away there
    // too, and comes back when they leave an empty field.
    //
    // Focus is tracked by the focus/blur handlers rather than compared against
    // document.activeElement: the field lives in a shadow root, so
    // document.activeElement is the host element, never the input itself.
    // -------------------------------------------------------------------------
    _syncPlaceholder() {
      var engaged = this._inputEngaged || Boolean(this._input.value);
      this._composer.setAttribute("data-ph-hidden", String(engaged));

      if (engaged) {
        this._stopPlaceholderCycle();
        return;
      }

      this._renderPlaceholder();
      this._startPlaceholderCycle();
    }

    // -------------------------------------------------------------------------
    // disconnectedCallback — called when <zy-widget> leaves the DOM
    // -------------------------------------------------------------------------
    // The variant's thinking state may own a requestAnimationFrame loop (Glow's
    // orb does). Without this, removing the element would leave that loop
    // running on a detached node — a permanent per-tab CPU cost on the
    // customer's site.
    disconnectedCallback() {
      this._abortThinking();
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
    // _resolveThinking — asks the variant's thinking controller to hand the
    // placeholder bubble back
    // -------------------------------------------------------------------------
    // Returns a promise ONLY when the controller animates out asynchronously, so
    // the caller knows it must defer writing the reply. Returns null when there
    // was nothing to resolve, which keeps the common path (typing dots, and
    // every token after the first) fully synchronous.
    //
    // The ordering matters: the controller clears the node as part of finishing
    // up, so writing the reply before awaiting it would have the reply wiped.
    _resolveThinking() {
      var thinking = this._thinking;
      if (!thinking) return null;
      this._thinking = null;
      var settled = thinking.done();
      return settled && typeof settled.then === "function" ? settled : null;
    }

    // -------------------------------------------------------------------------
    // _abortThinking — tears the placeholder down immediately
    // -------------------------------------------------------------------------
    // Used on the paths where there is no answer coming: errors, escalations,
    // timeouts, and teardown. No dissolve animation, because nothing is being
    // replaced — the caller is about to overwrite the node with text anyway.
    _abortThinking() {
      var thinking = this._thinking;
      if (!thinking) return;
      this._thinking = null;
      if (typeof thinking.destroy === "function") thinking.destroy();
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
      this._syncExpanded();
      this._syncPlaceholder();
      this._appendMessage("user", text);
      this._streaming = true;
      this._syncExpanded();
      this._sendBtn.disabled = true;
      // Placeholder bubble for the in-flight reply. A variant may offer
      // something richer than the typing dots (Glow shows a thinking orb); the
      // controller it returns owns the node until it hands the node back.
      var typing = this._appendMessage("agent", "");
      typing.classList.add("zy-msg-typing");
      this._thinking = this._variant.onThinking
        ? this._variant.onThinking(typing, this)
        : null;
      if (!this._thinking) {
        typing.innerHTML = '<span class="zy-typing-dots"><span class="zy-dot"></span><span class="zy-dot"></span><span class="zy-dot"></span></span>';
      }
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
          self._abortThinking();
          typing.classList.remove("zy-msg-typing");
          typing.classList.add("zy-msg-error");
          typing.textContent =
            error.message || "Something went wrong";
        })
        .finally(function () {
          self._streaming = false;
          self._sendBtn.disabled = false;
          self._syncExpanded();
          // Resume the idle hint once the reply has landed.
          self._startPlaceholderCycle();
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
          self._abortThinking();
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
            // The first token hands control back from the thinking orb. Wait for
            // it to release the node before writing, or its cleanup would wipe
            // the reply. Later tokens find nothing to resolve and take the
            // synchronous path, so streaming stays token-by-token.
            var handover = self._resolveThinking();
            if (handover) {
              handover.then(function () {
                typingNode.innerHTML = renderMd(reply);
                self._scrollToBottom();
              });
              return;
            }
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
          self._abortThinking();
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
          self._abortThinking();
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
