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
      this._viewportSync = null;     // visual-viewport listener record (mobile keyboard)
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

      // Mirror window.visualViewport into CSS custom properties so the open
      // panel — and Sleek's iframe — cling to the visible screen. On mobile
      // the keyboard overlays the layout viewport instead of resizing it, so
      // without this the browser pans and the panel's header slides off the
      // top of the screen exactly when the visitor starts typing.
      this._watchVisualViewport();

      // Modern Sleek's chat lives on a separate page. It needs only the
      // launcher and the frame, so hand off before wiring the panel.
      if (variant.iframe) {
        this._mountSleek();
        return;
      }

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
      this._products = [];
      // Whether this turn already rendered a product card. A provider error
      // (429, timeout) after a card must not be shown above it.
      this._turnHadProducts = false;
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

      // ---- Visitor and conversation ids live in the session ----
      // Both persist across reloads so a returning visitor resumes the same
      // conversation. _createSession() (below) reads and writes them.
      this._session = null;

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
    // -------------------------------------------------------------------------
    // The conversation itself lives in @repo/widget-core — transport, streaming,
    // storage and reconnect live there, so the React package and a future native
    // client share them. Everything below is rendering.
    // -------------------------------------------------------------------------
    _createSession() {
      var self = this;
      this._session = ZiyarnCore.createSession({
        apiBase: this._apiBase,
        secret: this._secret,
        slug: this._slug,
      });
      this._visitorId = this._session.visitorId;
      this._conversationId = this._session.conversationId;
      return this._session;
    }

    // -------------------------------------------------------------------------
    // _init — bootstrap the widget after DOM is ready
    // -------------------------------------------------------------------------
    //   1. Load the agent's config: name, description, placeholder prompts. This
    //      also validates the embed secret.
    //   2. If there is a saved conversation, replay it; otherwise greet.
    _init() {
      var self = this;
      this._createSession();
      this._session
        .loadConfig()
        .then(function (data) {
          if (data && data.agent) {
            if (data.agent.name) self._titleEl.textContent = data.agent.name;
            if (data.agent.description)
              self._subEl.textContent = data.agent.description;
          }
          if (data && data.placeholders) {
            self._setPlaceholders(data.placeholders);
          }
          self._products = data && Array.isArray(data.products) ? data.products : [];
          if (data && data.domain && data.domain.logoUrl) {
            self._setHeaderLogo(data.domain.logoUrl);
          }
        })
        .catch(function () {
          /* keep attribute defaults — API might be unreachable */
        });

      this._loadHistory();
    }

    // -------------------------------------------------------------------------
    // _mountSleek — launcher + full-screen iframe for Modern Sleek
    // -------------------------------------------------------------------------
    // The chat surface is the React page at /embed/<slug>. Keeping it in an
    // iframe gives it a private document for layout and styles, while the
    // customer still uses the same <zy-widget> tag as the other variants.
    _mountSleek() {
      var self = this;
      this._sleekLauncher = this._root.querySelector(".zy-launcher");
      this._sleekOverlay = this._root.querySelector(".zy-sleek-overlay");
      this._sleekFrame = this._root.querySelector(".zy-sleek-frame");

      var embedUrl;
      try {
        // The iframe page is served beside this script, not by data-api:
        // data-api points at the chat API, while /embed is an app route.
        embedUrl = new URL(
          "/embed/" + encodeURIComponent(this._slug),
          DEFAULT_API_BASE
        );
      } catch (_) {
        console.error("[zy-widget] could not build the Modern Sleek URL");
        return;
      }
      embedUrl.searchParams.set("secret", this._secret);
      this._sleekFrame.src = embedUrl.toString();
      this._sleekFrame.title = this._title || "Chat with us";

      this._sleekLauncher.addEventListener("click", function () {
        self._setSleekOpen(true);
      });

      // The iframe asks the host to close itself. event.source is the frame's
      // own window proxy, so another frame on the page cannot trigger this.
      this._sleekMessageHandler = function (event) {
        if (
          event.source === self._sleekFrame.contentWindow &&
          event.data &&
          event.data.type === "ziyarn:close"
        ) {
          self._setSleekOpen(false);
        }
      };
      window.addEventListener("message", this._sleekMessageHandler);

      // Escape is handled inside the iframe too; this covers the case where
      // focus is still on the host page when the frame opens.
      this._sleekKeyHandler = function (event) {
        if (event.key === "Escape" && self._open) {
          self._setSleekOpen(false);
        }
      };
      document.addEventListener("keydown", this._sleekKeyHandler);
    }

    _setSleekOpen(open) {
      this._open = open;
      this._wrap.setAttribute("data-open", String(open));
      this._sleekOverlay.hidden = !open;
      this._sleekLauncher.setAttribute(
        "aria-label",
        open ? "Close chat" : "Open chat"
      );
      this._sleekLauncher.setAttribute("aria-expanded", String(open));
      if (open) {
        this._sleekFrame.focus();
      } else {
        this._sleekLauncher.focus();
      }
    }

    // -------------------------------------------------------------------------
    // _watchVisualViewport — mobile keyboards overlay the screen, not resize it
    // -------------------------------------------------------------------------
    // iOS covers the lower screen with the keyboard without shrinking the
    // layout viewport, and Chrome for Android defaults to the same
    // resizes-visual behaviour. A panel sized to 100dvh is therefore taller
    // than the area above the keyboard, and as the browser pans the visual
    // viewport to reveal the focused input, the panel's top edge ends up
    // off-screen — the header disappears exactly when the visitor types.
    //
    // window.visualViewport describes what is actually visible. Mirror it into
    // two custom properties on the wrapper and let the mobile CSS do the rest:
    //
    //   --zy-vv-top  distance (px) from the layout viewport's top to the top
    //                of the visible area (non-zero while the page is panned)
    //   --zy-vvh     height (px) of the visible area, i.e. screen minus keyboard
    //
    // Browsers without the API never write the variables, so their fallbacks
    // (0px / 100dvh) keep the previous behaviour.
    _watchVisualViewport() {
      var self = this;
      var trackedViewport = window.visualViewport;
      if (!trackedViewport || this._viewportSync) return;

      var apply = function () {
        var currentVisualViewport = window.visualViewport;
        if (!currentVisualViewport || !self._wrap) return;
        // iOS reports negative offsets while the keyboard's pan settles.
        var visibleTop = Math.max(0, currentVisualViewport.offsetTop);
        self._wrap.style.setProperty("--zy-vv-top", visibleTop + "px");
        self._wrap.style.setProperty("--zy-vvh", currentVisualViewport.height + "px");
        // A panel that just shrank keeps its old scrollTop, which pins the
        // newest message below the fold. Re-seat it while the chat is open.
        if (self._open && self._messages) {
          self._messages.scrollTop = self._messages.scrollHeight;
        }
      };
      // Coalesce the event storm while the keyboard animates.
      var scheduledFrame = null;
      var onViewportChange = function () {
        if (scheduledFrame) return;
        scheduledFrame = window.requestAnimationFrame(function () {
          scheduledFrame = null;
          apply();
        });
      };
      trackedViewport.addEventListener("resize", onViewportChange);
      trackedViewport.addEventListener("scroll", onViewportChange);
      this._viewportSync = {
        viewport: trackedViewport,
        handler: onViewportChange,
      };
      apply();
    }

    _unwatchVisualViewport() {
      var trackedViewport = this._viewportSync;
      if (!trackedViewport) return;
      trackedViewport.viewport.removeEventListener("resize", trackedViewport.handler);
      trackedViewport.viewport.removeEventListener("scroll", trackedViewport.handler);
      this._viewportSync = null;
    }

    // -------------------------------------------------------------------------
    // _loadHistory — replay a saved conversation, then greet a new visitor
    // -------------------------------------------------------------------------
    _loadHistory() {
      var self = this;
      if (!this._session) return;
      var restored = this._session
        .loadHistory()
        .then(function (data) {
          if (data && Array.isArray(data.messages) && data.messages.length) {
            self._messages.textContent = ""; // clear greeting
            data.messages.forEach(function (message) {
              // Route each message to the correct visual style:
              //   "owner"   = human support agent
              //   role user = the visitor
              //   role assistant = the AI agent
              if (message.sender === "owner")
                self._appendMessage("owner", message.content || "");
              else if (message.role === "user")
                self._appendMessage("user", message.content || "");
              else if (message.role === "assistant")
                self._appendMessage("agent", message.content || "");
            });
            // A conversation that was escalated keeps getting human replies,
            // so start listening before the visitor says anything.
            if (data.conversation && data.conversation.status === "escalated") {
              self._listenForOwner();
            }
            return true;
          }
          return false;
        })
        .catch(function () {
          self._appendMessage("agent", "Hi there! How can we help you today?");
          return false;
        });

      void restored;
    }

    // -------------------------------------------------------------------------
    // _listenForOwner — keep the panel in step with the human teammate
    // -------------------------------------------------------------------------
    _listenForOwner() {
      var self = this;
      if (!this._session) return;
      this._session.listenForOwnerReplies({
        onMessage: function (message) {
          if (message.sender !== "owner" || !message.content) return;
          self._appendMessage("owner", message.content);
        },
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
    // _setHeaderLogo — show the domain's uploaded logo above the agent name.
    // -------------------------------------------------------------------------
    _setHeaderLogo(logoUrl) {
      var logo = this._root.querySelector(".zy-header-logo");
      if (!logo || typeof logoUrl !== "string") return;
      logo.addEventListener("error", function () {
        logo.hidden = true;
      });
      logo.src = logoUrl;
      logo.hidden = false;
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
      if (this._sleekMessageHandler) {
        window.removeEventListener("message", this._sleekMessageHandler);
        this._sleekMessageHandler = null;
      }
      if (this._sleekKeyHandler) {
        document.removeEventListener("keydown", this._sleekKeyHandler);
        this._sleekKeyHandler = null;
      }
      this._unwatchVisualViewport();
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
    //   4. The response is an SSE stream — read it incrementally
    //   5. On error, show an error message in the typing bubble
    //   6. On completion, re-enable the input and focus it
    //
    // The server streams SSE events:
    //   data: {"type":"text","delta":"Hello"}      — incremental AI text
    //   data: {"type":"escalate"}                   — handoff to human
    //   data: {"type":"done","conversationId":"x"}  — response complete
    //   data: {"type":"error","message":"..."}      — error occurred
    _send() {
      var self = this;
      var text = this._input.value.trim();
      if (!text || this._streaming || !this._session) return;

      this._input.value = "";
      this._syncExpanded();
      this._syncPlaceholder();
      this._appendMessage("user", text);
      this._streaming = true;
      this._syncExpanded();
      this._sendBtn.disabled = true;

      // Placeholder bubble for the in-flight reply. A variant may offer something
      // richer than the typing dots (Glow shows a thinking orb); the controller
      // it returns owns the node until it hands the node back.
      var typing = this._appendMessage("agent", "");
      typing.classList.add("zy-msg-typing");
      this._thinking = this._variant.onThinking
        ? this._variant.onThinking(typing, this)
        : null;
      if (!this._thinking) {
        typing.innerHTML =
          '<span class="zy-typing-dots"><span class="zy-dot"></span><span class="zy-dot"></span><span class="zy-dot"></span></span>';
      }

      // The agent's typing indicator must be visible for a beat even when the
      // first token lands instantly, or a fast reply looks like a glitch.
      this._typingStartedAt = Date.now();
      this._typingMinimumMs = 600;
      this._reply = "";
      this._turnHadProducts = false;

      this._session
        .send(text, {
          onDelta: function (delta) {
            self._reply += delta;
            self._renderReply(typing);
          },
          onTool: function (name, args) {
            if (name !== "sell_product") return;
            var productName = args && typeof args.product === "string" ? args.product : "";
            var product = self._findProduct(productName);
            if (product) {
              self._appendProductCard(product);
              self._turnHadProducts = true;
            }
          },
          onEscalate: function () {
            self._abortThinking();
            self._setStatus("Connecting you with a human...");
            typing.classList.remove("zy-msg-typing");
            typing.textContent =
              "I've asked a human teammate to take over - they'll join this chat shortly.";
            self._scrollToBottom();
            self._listenForOwner();
          },
          onDone: function (conversationId) {
            self._conversationId = conversationId || self._conversationId;
            self._listenForOwner();
          },
          onError: function (message) {
            self._abortThinking();
            typing.classList.remove("zy-msg-typing");
            // A card already answered the visitor's question. Provider errors
            // (429, timeout) must not sit above the cards — keep any partial
            // text, otherwise drop the empty bubble entirely.
            if (self._turnHadProducts) {
              if (self._reply) {
                typing.innerHTML = renderMd(self._reply);
              } else {
                typing.remove();
              }
              self._scrollToBottom();
              return;
            }
            typing.classList.add("zy-msg-error");
            typing.textContent = message;
          },
        })
        .then(function () {
          // A turn that ended with nothing rendered (aborted, or an error the
          // shell handled) must not leave an empty bubble behind.
          if (!self._reply) {
            self._abortThinking();
            typing.classList.remove("zy-msg-typing");
          }
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
    // _renderReply — write the accumulated reply into the placeholder bubble
    // -------------------------------------------------------------------------
    // The first token hands control back from the thinking orb. Wait for it to
    // release the node before writing, or its cleanup would wipe the reply.
    // Later tokens find nothing to resolve and take the synchronous path, so
    // streaming stays token by token.
    _renderReply(typingNode) {
      var handover = this._resolveThinking();
      if (handover) {
        var node = typingNode;
        var self = this;
        // Read this._reply when the orb releases the node, not now: tokens
        // keep arriving while it animates out, and a snapshot taken here
        // would land on screen after the newer renders and undo them.
        handover.then(function () {
          node.innerHTML = renderMd(self._reply);
          self._scrollToBottom();
        });
        return;
      }
      typingNode.innerHTML = renderMd(this._reply);
      this._scrollToBottom();
    }

    _findProduct(name) {
      var normalizedName = String(name || "").trim().toLowerCase();
      for (var index = 0; index < this._products.length; index += 1) {
        var product = this._products[index];
        if (String(product.name || "").trim().toLowerCase() === normalizedName) return product;
      }
      return null;
    }

    _appendProductCard(product) {
      var card = document.createElement("article");
      card.className = "zy-product-card";
      if (product.imageUrl) {
        var image = document.createElement("img");
        image.className = "zy-product-image";
        image.src = product.imageUrl;
        image.alt = product.name || "Product";
        card.appendChild(image);
      }
      var details = document.createElement("div");
      details.className = "zy-product-details";
      var title = document.createElement("p");
      title.className = "zy-product-name";
      title.textContent = product.name || "Product";
      var price = document.createElement("p");
      price.className = "zy-product-price";
      try {
        price.textContent = new Intl.NumberFormat(undefined, { style: "currency", currency: String(product.currency || "GHS").toUpperCase() }).format((Number(product.priceCents) || 0) / 100);
      } catch (_) {
        price.textContent = ((Number(product.priceCents) || 0) / 100).toFixed(2) + " " + String(product.currency || "GHS").toUpperCase();
      }
      details.appendChild(title);
      details.appendChild(price);
      card.appendChild(details);
      this._messages.appendChild(card);
      this._scrollToBottom();
    }

  }

