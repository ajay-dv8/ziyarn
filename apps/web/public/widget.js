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
 *   data-trigger  chat trigger launcher   (default "default" — see TRIGGERS;
 *                 server config wins when present)
 *
 * Classic and Glow render inside the shadow root, so host page CSS cannot leak
 * in or out. Modern Sleek mounts the Strands glass-orb launcher and loads its
 * chat surface from /embed/<slug> in a full-screen iframe.
 *
 * Architecture:
 *   1. Registers <zy-widget> via customElements.define()
 *   2. connectedCallback() reads data-* attributes and builds the shadow root
 *      from the resolved variant's CSS + markup
 *   3. Classic/Glow wire the panel in that shadow root; Modern Sleek shows its
 *      iframe overlay and listens for the chat's `ziyarn:close` message
 *   4. Visitor messages are POSTed to /api/chat as SSE streams, rendered
 *      token by token via renderMd()
 *   5. After the AI responds, a delta loop long-polls for owner (human) replies
 *      via GET /api/chat?since=X&stream=1
 *
 * Layout of the generated file:
 *   preamble.js      this header + IIFE open + API base detection
 *   helpers.js       DOM helpers, markdown renderer, variant registry
 *   orb.js           thinking-orb canvas renderer (Glow)
 *   strands.js       glass-orb launcher renderer (Modern Sleek)
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

/* core — @repo/widget-core, bundled (transport, stream, session, store) */
"use strict";var ZiyarnCore=(()=>{var D=Object.defineProperty;var P=Object.getOwnPropertyDescriptor;var H=Object.getOwnPropertyNames;var C=Object.prototype.hasOwnProperty;var N=(i,o)=>{for(var a in o)D(i,a,{get:o[a],enumerable:!0})},x=(i,o,a,d)=>{if(o&&typeof o=="object"||typeof o=="function")for(let n of H(o))!C.call(i,n)&&n!==a&&D(i,n,{get:()=>o[n],enumerable:!(d=P(o,n))||d.enumerable});return i};var B=i=>x(D({},"__esModule",{value:!0}),i);var M={};N(M,{StaleConversationError:()=>T,createSession:()=>_,createStore:()=>w,createTransport:()=>I,newVisitorId:()=>E});var A="/api/chat";function w(i){let o=a=>`zy:${a}:${i}`;return{load(a){try{return localStorage.getItem(o(a))}catch{return null}},save(a,d){try{localStorage.setItem(o(a),d)}catch{}}}}function E(){return typeof crypto<"u"&&typeof crypto.randomUUID=="function"?crypto.randomUUID():`v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`}function I({apiBase:i,secret:o}){let a=r=>`${i}${r}`,d=()=>({"x-embed-secret":o});async function n(r,g={}){let c=await fetch(a(r),{...g,headers:{...d(),...g.headers}});if(!c.ok){let m=(await c.json().catch(()=>({})))?.error?.message??`Request failed (${c.status})`;throw new Error(m)}return await c.json()}let y=async r=>{if(!r.ok||!r.body){let c=(await r.json().catch(()=>({})))?.error,S=new Error(c?.message??`Request failed (${r.status})`);throw c?.code==="NOT_FOUND"&&(S.name="StaleConversation"),S}return r.body};function b(r,g,c){return fetch(a(r),{method:"POST",headers:{...d(),"content-type":"application/json"},body:JSON.stringify(g),signal:c}).then(y)}function u(r){return fetch(a(r),{method:"GET",headers:d()}).then(y)}async function f(r,g){let c=r.getReader(),S=new TextDecoder,m="",h=()=>c.read().then(({done:v,value:R})=>{if(v)return;m+=S.decode(R,{stream:!0});let e=m.split(`

`);m=e.pop()??"";for(let t of e){let l=t.split(`
`)[0]??"";if(l.startsWith("data:"))try{g(JSON.parse(l.slice(5).trim()))}catch{}}return h()});return h()}return{json:n,stream:b,streamGet:u,readEvents:f}}var T=class extends Error{},U=9e4,k=2500,$=200;function _(i){let o=I({apiBase:i.apiBase,secret:i.secret}),a=w(i.slug),d=a.load("visitor")??E();a.save("visitor",d);let n=a.load("conversation"),y=null,b=!1,u=null,f=!1,r=null,g=null,c=e=>{if(!e)return;let t=Date.parse(e);Number.isNaN(t)||(y=new Date(t))},S=e=>{for(let t=e.length-1;t>=0;t-=1){let l=e[t]?.createdAt;if(l){c(l);return}}};function m(e){r&&clearTimeout(r),r=setTimeout(()=>{r=null,g&&h(g)},e)}function h(e){if(f||!n||!y)return;f=!0,g=e;let t=`${A}?conversationId=${encodeURIComponent(n)}&since=${encodeURIComponent(y.toISOString())}&stream=1`;o.streamGet(t).then(l=>o.readEvents(l,p=>{if(p.type==="message"&&p.message){e.onMessage(p.message),c(p.message.createdAt);return}f=!1,p.type==="done"&&c(p.serverTime),m(p.type==="error"?k:$)})).catch(()=>{f=!1,m(k)})}async function v(e,t){try{return await o.stream(A,{message:e,visitorId:d,conversationId:n??void 0},t)}catch(l){throw l instanceof Error&&l.name==="StaleConversation"?new T(l.message):l}}async function R(e,t,l){let p=await v(e,u.signal);await o.readEvents(p,s=>{if(l(),t.onTick?.(),s.type==="text"){t.onDelta(s.delta);return}if(s.type==="tool"){t.onTool(s.name,s.args);return}if(s.type==="escalate"){t.onEscalate();return}if(s.type==="error"){t.onError(s.message??"Something went wrong",s.code);return}s.conversationId&&(n=s.conversationId,a.save("conversation",s.conversationId)),c(s.serverTime??new Date().toISOString()),t.onDone(s.conversationId??n)})}return{get visitorId(){return d},get conversationId(){return n},get streaming(){return b},async loadConfig(){return o.json(A)},async loadHistory(){if(!n)return null;let e=await o.json(`${A}?conversationId=${encodeURIComponent(n)}`);return S(e.messages??[]),e},listenForOwnerReplies(e){h(e)},stopListening(){f=!1,g=null,r&&(clearTimeout(r),r=null)},async send(e,t){if(b)return;b=!0,u=new AbortController;let l=t.inactivityTimeoutMs??U,p=null,s=()=>{p&&clearTimeout(p),p=setTimeout(()=>{u?.abort(),t.onError("Response timed out. Please try again.")},l)};s();try{await R(e,t,s)}catch(O){O instanceof T?(n=null,y=null,a.save("conversation",""),s(),await R(e,t,s)):u?.signal.aborted||t.onError(O instanceof Error?O.message:"Something went wrong")}finally{p&&clearTimeout(p),b=!1,u=null}},stop(){u?.abort()}}}return B(M);})();

/* helpers — dom utilities, markdown, variant registry */
  var DEFAULT_API_BASE = (function () {
    try {
      return new URL(SCRIPT_SRC, location.href).origin;
    } catch (_) {
      return location.origin;
    }
  })();

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
  // Agent replies arrive as light markdown. This is the Shadow DOM twin of
  // apps/web/lib/widget-markdown.ts (which the React surfaces use) — keep the
  // two in sync. Supported: paragraphs, hard line breaks, bullet lists,
  // numbered lists, headings, fenced code, blockquotes, horizontal rules,
  // **bold**, *italic*, _italic_, `code`, ~~strikethrough~~, markdown links,
  // bare https:// links, and em/en-dash spacing.
  //
  // Safety: every literal text run passes through esc() before it reaches the
  // string, and only the tags this file emits are ever produced, so raw HTML
  // from the model cannot survive into innerHTML. It runs on every streaming
  // token, so partial syntax ("**bold" without a close) must render literally
  // instead of throwing or swallowing the rest of the bubble.
  function renderMd(text, locations) {
    if (!text) return "";

    var source = String(text)
      .replace(/\r\n?/g, "\n")
      // Tabs/spaces only: a leading \s* would eat line breaks around a dash
      // that ends a line.
      .replace(/[ \t]*\u2014[ \t]*/g, " \u2014 ")
      .replace(/[ \t]*\u2013[ \t]*/g, " - ");

    var lines = source.split("\n");
    var html = "";
    var index = 0;
    var locationMap = {};
    if (Array.isArray(locations)) {
      for (var locationIndex = 0; locationIndex < locations.length; locationIndex += 1) {
        var configuredLocation = locations[locationIndex];
        if (configuredLocation && typeof configuredLocation.id === "string") {
          locationMap[configuredLocation.id] = configuredLocation;
        }
      }
    }

    while (index < lines.length) {
      var line = lines[index];

      if (/^\s*$/.test(line)) {
        index += 1;
        continue;
      }

      if (/^\s*```/.test(line)) {
        index += 1;
        var codeLines = [];
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        html +=
          '<pre class="zy-md-pre"><code>' +
          esc(codeLines.join("\n")) +
          "</code></pre>";
        continue;
      }

      var heading = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*$/);
      if (heading) {
        html +=
          '<p class="zy-md-h">' +
          renderMdInline(heading[1], locationMap) +
          "</p>";
        index += 1;
        continue;
      }

      if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += '<hr class="zy-md-hr">';
        index += 1;
        continue;
      }

      if (/^\s{0,6}[-*+]\s+/.test(line)) {
        var bullets = "";
        while (index < lines.length) {
          var bullet = lines[index].match(/^\s{0,6}[-*+]\s+(.*)$/);
          if (!bullet) break;
          bullets +=
            "<li>" + renderMdInline(bullet[1].trim(), locationMap) + "</li>";
          index += 1;
        }
        html += '<ul class="zy-md-list">' + bullets + "</ul>";
        continue;
      }

      if (/^\s{0,6}\d{1,3}[.)]\s+/.test(line)) {
        var firstNumber = line.match(/^\s{0,6}(\d{1,3})[.)]\s+/);
        var start = firstNumber ? parseInt(firstNumber[1], 10) : 1;
        var numbers = "";
        while (index < lines.length) {
          var numbered = lines[index].match(/^\s{0,6}\d{1,3}[.)]\s+(.*)$/);
          if (!numbered) break;
          numbers +=
            "<li>" +
            renderMdInline(numbered[1].trim(), locationMap) +
            "</li>";
          index += 1;
        }
        html +=
          '<ol class="zy-md-list"' +
          (start > 1 ? ' start="' + start + '"' : "") +
          ">" +
          numbers +
          "</ol>";
        continue;
      }

      if (/^\s{0,3}>\s?/.test(line)) {
        var quotedLines = [];
        while (index < lines.length) {
          var quoted = lines[index].match(/^\s{0,3}>\s?(.*)$/);
          if (!quoted) break;
          quotedLines.push(quoted[1]);
          index += 1;
        }
        html +=
          '<blockquote class="zy-md-quote">' +
          renderMdInline(quotedLines.join("\n"), locationMap) +
          "</blockquote>";
        continue;
      }

      var paragraph = [];
      while (
        index < lines.length &&
        !/^\s*$/.test(lines[index]) &&
        !isMdBlockStart(lines[index])
      ) {
        paragraph.push(lines[index]);
        index += 1;
      }
      html +=
        "<p>" + renderMdInline(paragraph.join("\n"), locationMap) + "</p>";
    }

    return html;
  }

  function isMdBlockStart(line) {
    return (
      /^\s*```/.test(line) ||
      /^\s{0,3}#{1,6}\s+/.test(line) ||
      /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
      /^\s{0,6}[-*+]\s+/.test(line) ||
      /^\s{0,6}\d{1,3}[.)]\s+/.test(line) ||
      /^\s{0,3}>\s?/.test(line)
    );
  }

  // Inline markdown. Escapes literal runs itself; recursive calls return HTML.
  function renderMdInline(source, locationMap) {
    var html = "";
    var plain = "";
    var index = 0;

    function flushPlain() {
      if (plain) {
        html += esc(plain);
        plain = "";
      }
    }

    while (index < source.length) {
      var character = source[index];

      if (character === "\n") {
        flushPlain();
        html += "<br>";
        index += 1;
        continue;
      }

      if (character === "`") {
        var codeClose = source.indexOf("`", index + 1);
        if (codeClose !== -1) {
          flushPlain();
          html += "<code>" + esc(source.slice(index + 1, codeClose)) + "</code>";
          index = codeClose + 1;
          continue;
        }
      }

      if (source.slice(index, index + 2) === "**") {
        var strongClose = source.indexOf("**", index + 2);
        if (strongClose !== -1 && strongClose > index + 2) {
          flushPlain();
          html +=
            "<strong>" +
            renderMdInline(source.slice(index + 2, strongClose), locationMap) +
            "</strong>";
          index = strongClose + 2;
          continue;
        }
      }

      if (source.slice(index, index + 2) === "~~") {
        var delClose = source.indexOf("~~", index + 2);
        if (delClose !== -1 && delClose > index + 2) {
          flushPlain();
          html +=
            "<del>" +
            renderMdInline(source.slice(index + 2, delClose), locationMap) +
            "</del>";
          index = delClose + 2;
          continue;
        }
      }

      if (character === "*") {
        var emClose = source.indexOf("*", index + 1);
        if (emClose !== -1 && emClose > index + 1) {
          flushPlain();
          html +=
            "<em>" +
            renderMdInline(source.slice(index + 1, emClose), locationMap) +
            "</em>";
          index = emClose + 1;
          continue;
        }
      }

      // Underscore emphasis only at word boundaries, so identifiers like
      // product_name survive untouched.
      if (
        character === "_" &&
        (index === 0 || !/[A-Za-z0-9]/.test(source[index - 1]))
      ) {
        var underscoreClose = findMdUnderscoreClose(source, index + 1);
        if (underscoreClose !== -1) {
          flushPlain();
          html +=
            "<em>" +
            renderMdInline(source.slice(index + 1, underscoreClose), locationMap) +
            "</em>";
          index = underscoreClose + 1;
          continue;
        }
      }

      if (character === "[") {
        var remaining = source.slice(index);
        var lowerRemaining = remaining.toLowerCase();
        var locationMatch = remaining.match(
          /^\[\[location:\s*([^\]\n]*?)\s*\]\]/i
        );
        if (locationMatch) {
          flushPlain();
          var markerBody = locationMatch[1].trim();
          var separator = markerBody.indexOf("|");
          var locationId =
            separator === -1 ? "" : markerBody.slice(0, separator).trim();
          var markerLabel =
            separator === -1 ? markerBody : markerBody.slice(separator + 1).trim();
          var knownLocation =
            locationId && locationMap[locationId]
              ? locationMap[locationId]
              : null;

          if (knownLocation) {
            var displayText =
              knownLocation.address || knownLocation.label || markerLabel;
            html += mdLocationAnchor(mdMapUrl(knownLocation), displayText);
          } else if (separator === -1 && markerBody) {
            // Backwards compatibility: the old marker held a place name.
            if (markerBody.length <= MD_LOCATION_MAX_LENGTH) {
              html += mdLocationAnchor(mdLocationUrl(markerBody), markerBody);
            } else {
              html += esc(markerBody.slice(0, MD_LOCATION_MAX_LENGTH));
            }
          } else if (markerLabel) {
            // Unknown id: show the readable label without inventing a link.
            html += esc(markerLabel.slice(0, MD_LOCATION_MAX_LENGTH));
          }
          index += locationMatch[0].length;
          continue;
        }
        if (lowerRemaining.indexOf(MD_LOCATION_PREFIX) === 0) {
          var partialBody = remaining.slice(MD_LOCATION_PREFIX.length);
          if (partialBody.indexOf("\n") === -1) {
            flushPlain();
            var visibleText = mdPartialLocationText(partialBody);
            if (visibleText) {
              html += esc(visibleText.slice(0, MD_LOCATION_MAX_LENGTH));
            }
            index = source.length;
            continue;
          }
        } else if (
          remaining.length < MD_LOCATION_PREFIX.length &&
          MD_LOCATION_PREFIX.indexOf(lowerRemaining) === 0
        ) {
          // The marker is still arriving; do not show `[[location:` as text.
          flushPlain();
          index = source.length;
          continue;
        }
        var link = source.slice(index).match(/^\[([^\]]*)\]\(([^)\s]+)\)/);
        if (link && isMdSafeUrl(link[2])) {
          flushPlain();
          html +=
            '<a href="' +
            esc(link[2]) +
            '" target="_blank" rel="noopener noreferrer">' +
            renderMdInline(link[1], locationMap) +
            "</a>";
          index += link[0].length;
          continue;
        }
      }

      // Bare URLs, only at a word boundary so "xhttps://…" stays text.
      if (
        (character === "h" || character === "H") &&
        (index === 0 || /[\s([<]/.test(source[index - 1])) &&
        /^https?:\/\//i.test(source.slice(index))
      ) {
        var urlMatch = source.slice(index).match(/^https?:\/\/[^\s<>"']+/i);
        if (urlMatch) {
          var url = trimMdUrl(urlMatch[0]);
          if (url.length > 8) {
            flushPlain();
            html +=
              '<a href="' +
              esc(url) +
              '" target="_blank" rel="noopener noreferrer">' +
              esc(url) +
              "</a>";
            index += url.length;
            continue;
          }
        }
      }

      plain += character;
      index += 1;
    }

    flushPlain();
    return html;
  }

  var MD_LOCATION_PREFIX = "[[location:";
  var MD_LOCATION_MAX_LENGTH = 300;

  function mdLocationUrl(place) {
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(place)
    );
  }

  function mdLocationAnchor(url, text) {
    return (
      '<a href="' +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(text) +
      "</a>"
    );
  }

  function mdMapUrl(location) {
    var latitude =
      typeof location.latitude === "number" ? location.latitude : null;
    var longitude =
      typeof location.longitude === "number" ? location.longitude : null;

    if (latitude !== null && longitude !== null) {
      if (mdIsIos()) {
        return "https://maps.apple.com/?daddr=" + latitude + "," + longitude;
      }
      var mapUrl =
        "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(latitude + "," + longitude);
      if (location.placeId) {
        mapUrl +=
          "&destination_place_id=" + encodeURIComponent(location.placeId);
      }
      return mapUrl;
    }

    if (location.placeId) {
      return (
        "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent(location.address || location.label || "") +
        "&destination_place_id=" +
        encodeURIComponent(location.placeId)
      );
    }

    if (
      typeof location.mapsUrl === "string" &&
      /^https:\/\//i.test(location.mapsUrl)
    ) {
      return location.mapsUrl;
    }

    return mdLocationUrl(location.address || location.label || "");
  }

  function mdIsIos() {
    var userAgent = navigator.userAgent || "";
    return (
      /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  function mdPartialLocationText(body) {
    var pipe = body.indexOf("|");
    if (pipe !== -1) return body.slice(pipe + 1).trim();
    var text = body.trim();
    // Hide the new id-only tag while it streams; the id is not visitor-facing.
    return text.indexOf("loc_") === 0 || "loc_".indexOf(text) === 0 ? "" : text;
  }

  function isMdSafeUrl(url) {
    return /^(?:https?:\/\/|mailto:)/i.test(url);
  }

  function findMdUnderscoreClose(source, from) {
    for (var index = from; index < source.length; index += 1) {
      if (source[index] !== "_") continue;
      var previous = source[index - 1] || "";
      var next = source[index + 1] || "";
      if (/\s/.test(previous)) continue;
      if (next && /[A-Za-z0-9]/.test(next)) continue;
      return index;
    }
    return -1;
  }

  function trimMdUrl(url) {
    var trimmed = url.replace(/[.,;:!?]+$/, "");
    while (
      trimmed.slice(-1) === ")" &&
      countMdCharacter(trimmed, ")") > countMdCharacter(trimmed, "(")
    ) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
  }

  function countMdCharacter(value, character) {
    var count = 0;
    for (var index = 0; index < value.length; index += 1) {
      if (value[index] === character) count += 1;
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // ZyWidget — custom element class
  // ---------------------------------------------------------------------------
  // Lifecycle: constructor() → connectedCallback() → (user interacts) → disconnectedCallback()
  // The widget manages its own state (open/closed, streaming, conversation ID)

  var VARIANTS = {};
  var DEFAULT_VARIANT_ID = "classic";

  /**
   * @param {string} id
   * @param {{
   *   css: string,
   *   markup: function(object): string,
   *   iframe?: boolean,
   *   onThinking?: function(HTMLElement, object): {
   *     done: function(): Promise<void>|void,
   *     destroy?: function(): void
   *   }
   * }} variant
   *
   * `iframe: true` marks a variant whose chat surface is a separate page
   * (Modern Sleek). The engine mounts its launcher/frame and skips the panel
   * wiring, so the variant's markup must not rely on the panel classes.
   *
   * `onThinking` is optional. Without it the engine renders the bouncing typing
   * dots. With it, the variant owns the placeholder bubble from the moment a
   * request goes out until it calls `done()` (answer incoming — may be async,
   * the engine waits for the node) or `destroy()` (error, escalation, teardown).
   * A controller that never settles would strand an empty bubble, so both paths
   * must be reachable.
   */
  function registerWidget(id, variant) {
    VARIANTS[id] = variant;
  }

  // -------------------------------------------------------------------------
  // Chat trigger registry — WHO RENDERS THE LAUNCHER.
  //
  // "default" (or an unknown id, warned about) keeps the launcher each widget
  // variant ships, so a domain that has not chosen a trigger renders exactly
  // what it did before this registry existed. Otherwise the variant's markup
  // is asked to leave its launcher out (the engine passes `trigger` in its
  // config), and the picked trigger's button is mounted in its place.
  // -------------------------------------------------------------------------

  var TRIGGERS = {};

  /**
   * @param {string} id
   * @param {{
   *   css: string,
   *   markup: function(object): string
   * }} trigger
   */
  function registerTrigger(id, trigger) {
    TRIGGERS[id] = trigger;
    trigger.id = id;
  }

  /**
   * Resolves the server/attribute trigger id to a registered trigger,
   * FAILING OPEN to null, meaning "the launcher built into the variant".
   *
   * A missing value and an unknown id both reach the built-in launcher, so a
   * typo can never leave a customer's website without a launcher to click —
   * it only falls back to the button the widget always shipped.
   */
  function resolveTrigger(name) {
    if (typeof name !== "string") return null;
    var key = name.trim();
    if (!key) return null;
    if (!TRIGGERS[key]) {
      console.warn(
        '[zy-widget] unknown chat trigger "' +
          key +
          '" — using the launcher built into the widget'
      );
      return null;
    }
    return TRIGGERS[key];
  }

  /**
   * Resolves data-variant to a registered variant, FAILING OPEN.
   *
   * Every widget already embedded on a customer site predates this attribute,
   * so a missing value must mean classic. A typo must never leave a paying
   * customer's website with a blank chat widget — warn and fall back.
   */
  function resolveVariant(name) {
    var fallback = VARIANTS[DEFAULT_VARIANT_ID];
    if (typeof name === "string") {
      var key = name.trim();
      if (key) {
        if (VARIANTS[key]) return VARIANTS[key];
        console.warn(
          '[zy-widget] unknown data-variant "' +
            key +
            '" — falling back to ' +
            DEFAULT_VARIANT_ID
        );
      }
    }
    return fallback;
  }

/* thinking orb — canvas renderer + timeline engine (Glow) */
  // ---------------------------------------------------------------------------
  // Thinking orb — ported from the "AI Thinking Orb" component (anark17r/ai-thinking-orb-and-input)
  // ---------------------------------------------------------------------------
  // WHAT IS PORTED vs DROPPED, and why
  //
  // Ported verbatim: the seeded point cloud, the 3D projection and painter's
  // algorithm, the colour ramp, cubic-bezier solver and easing set, the
  // track/timeline engine, and the assemble → resolve → condense motion.
  // The maths is the component's; only the plumbing around it changed.
  //
  // Dropped: launch (pill collapses to a ball), unfold (orb morphs into an answer
  // card), the input form, and the fixed status label. That choreography assumes
  // the orb owns the entire viewport and that a question produces exactly one
  // answer. The widget does neither — it is a chat panel with history, streaming
  // and follow-up turns. So the orb becomes the THINKING STATE: it appears where
  // the typing dots would be, thinks while the request is in flight, sweeps as
  // the answer arrives, and dissolves to make room for the real reply.
  //
  // The original drives geometry through CSS custom properties (--w, --h, --r)
  // set on a single .mo-actor, because the pill and the orb are the same element
  // at different times. Here the pill is always the composer, so there is no
  // morph to drive and the orb reads its own state from P.* directly. The colour
  // ramp is unchanged: rgb(235,235,235) → rgb(52,211,153), which already matches
  // the Ziyarn accent.

  // ─────────────────────────── maths + easing ───────────────────────────
  var MO_TAU = Math.PI * 2;

  function moClamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function moLerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  // 4 decimals is plenty for sub-pixel values and keeps the CSS strings short.
  function moFmt(value) {
    return String(Math.round(value * 1e4) / 1e4);
  }

  // Deterministic PRNG so the dot cloud is identical on every load. A random
  // cloud would make the orb "reshuffle" between mounts, which reads as a bug.
  function moMulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Newton-Raphson with a bisection fallback: the derivative vanishes at the
  // endpoints, where Newton stalls, so fall back rather than returning garbage.
  function moCubicBezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    function sampleX(t) {
      return ((ax * t + bx) * t + cx) * t;
    }
    function sampleY(t) {
      return ((ay * t + by) * t + cy) * t;
    }
    function slopeX(t) {
      return (3 * ax * t + 2 * bx) * t + cx;
    }
    function solve(x) {
      var t = x, i, err, deriv;
      for (i = 0; i < 8; i++) {
        err = sampleX(t) - x;
        if (Math.abs(err) < 1e-6) return t;
        deriv = slopeX(t);
        if (Math.abs(deriv) < 1e-6) break;
        t -= err / deriv;
      }
      var lo = 0, hi = 1;
      t = x;
      for (i = 0; i < 40; i++) {
        err = sampleX(t);
        if (Math.abs(err - x) < 1e-6) break;
        if (x > err) lo = t;
        else hi = t;
        t = (hi - lo) / 2 + lo;
      }
      return t;
    }
    return function (x) {
      return x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x));
    };
  }

  var MO_E = {
    out: moCubicBezier(0.22, 1, 0.36, 1),
    io: moCubicBezier(0.65, 0, 0.35, 1),
    in: moCubicBezier(0.4, 0, 1, 1),
    grow: moCubicBezier(0.3, 0, 0.2, 1),
    vortex: moCubicBezier(0.6, 0, 0.2, 1),
    spring: moCubicBezier(0.34, 1.4, 0.64, 1),
  };

  // ─────────────────────────── geometry constants ───────────────────────────
  // Scaled down from the original (ORB_R 66 → 52, CANVAS 220 → 176) so the orb
  // sits comfortably inside a message bubble in a ~380px chat panel.
  var MO_CANVAS = 176;
  var MO_R = 52;

  // ─────────────────────────── the dot cloud ───────────────────────────
  // Fibonacci-ish sphere: 16 rings, ring k at height y, with enough points on
  // it to keep the spacing even as the ring shrinks toward the poles.
  var MO_RINGS = 16;
  var MO_DOTS = (function () {
    var random = moMulberry32(7);
    var dots = [];
    for (var ring = 0; ring < MO_RINGS; ring++) {
      var y = 1 - ((ring + 0.5) / MO_RINGS) * 2;
      var r = Math.sqrt(1 - y * y);
      var count = Math.max(4, Math.round(30 * r));
      for (var j = 0; j < count; j++) {
        var angle = (j / count) * MO_TAU + ring * 0.35;
        dots.push({
          x: Math.cos(angle) * r,
          y: y,
          z: Math.sin(angle) * r,
          u: (1 - y) / 2,
          seed: random() * MO_TAU,
        });
      }
    }
    return dots;
  })();

  var MO_N = MO_DOTS.length;
  var MO_DX = new Float32Array(MO_N);
  var MO_DY = new Float32Array(MO_N);
  var MO_DZ = new Float32Array(MO_N);
  var MO_DU = new Float32Array(MO_N);
  var MO_DS = new Float32Array(MO_N);
  (function () {
    for (var index = 0; index < MO_N; index++) {
      MO_DX[index] = MO_DOTS[index].x;
      MO_DY[index] = MO_DOTS[index].y;
      MO_DZ[index] = MO_DOTS[index].z;
      MO_DU[index] = MO_DOTS[index].u;
      MO_DS[index] = MO_DOTS[index].seed;
    }
  })();

  // ─────────────────────────── colour ramp ───────────────────────────
  // Pre-baked into a lookup table: 25 green steps × 49 alpha steps. Interpolating
  // rgba() strings per dot per frame would allocate ~1200 strings a frame.
  var MO_G_STEPS = 24;
  var MO_A_STEPS = 48;
  var MO_COLORS = (function () {
    var table = [];
    for (var gi = 0; gi <= MO_G_STEPS; gi++) {
      var g = gi / MO_G_STEPS;
      var red = Math.round(moLerp(235, 52, g));
      var green = Math.round(moLerp(235, 211, g));
      var blue = Math.round(moLerp(235, 153, g));
      for (var ai = 0; ai <= MO_A_STEPS; ai++) {
        table.push(
          "rgba(" + red + "," + green + "," + blue + "," + (ai / MO_A_STEPS).toFixed(3) + ")",
        );
      }
    }
    return table;
  })();

  // ─────────────────────────── the renderer ───────────────────────────
  // Per-dot state, preallocated once and reused every frame. Scratch buffers are
  // written in the update pass and read in the draw pass, which is why the draw
  // is split into two passes: everything behind the equator, then everything in
  // front. A single pass would let a front dot be painted before a back dot and
  // the orb would flicker.
  function moCreateOrb(canvas, getSpeed, isReduced) {
    var P = {
      k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1,
      vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0,
    };
    var ctx = canvas.getContext ? canvas.getContext("2d") : null;
    var lit = new Float32Array(MO_N);
    var screenX = new Float32Array(MO_N);
    var screenY = new Float32Array(MO_N);
    var radius = new Float32Array(MO_N);
    var depth = new Float32Array(MO_N);
    var colorIndex = new Int16Array(MO_N);
    // pw[] holds the strength of each of the four light programs, eased toward
    // their target one at a time so switching programs cross-fades.
    var pw = [1, 0, 0, 0];

    var time = 0, raf = 0, last = 0, dead = false;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(MO_CANVAS * dpr);
    canvas.height = Math.round(MO_CANVAS * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Fixed 0.35 rad tilt: reads as a deliberate three-quarter view rather than
    // an equator-on sphere where the depth cue disappears.
    var S = 0.6, COS_TILT = Math.cos(0.35), SIN_TILT = Math.sin(0.35);
    var centre = MO_CANVAS / 2;

    function draw(dt) {
      if (!ctx) return;
      ctx.clearRect(0, 0, MO_CANVAS, MO_CANVAS);
      time += dt;
      P.rot += P.spin * dt;

      var yaw = P.rot + P.vortex;
      var cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
      var stepWeight = dt / 0.35;
      for (var q = 0; q < 4; q++) {
        var delta = (q === P.prog ? 1 : 0) - pw[q];
        pw[q] += Math.abs(delta) <= stepWeight ? delta : delta > 0 ? stepWeight : -stepWeight;
      }

      var decay = Math.exp(-dt / 0.5);
      var headA = (time * 300) % MO_N;
      var headB = (time * 480) % MO_N;
      // Two orbiting point lights, so the orb is lit from two directions.
      var angA = time * 0.8, bA = Math.sin(time * 0.5) * 0.9;
      var f1x = Math.cos(bA) * Math.cos(angA), f1y = Math.sin(bA), f1z = Math.cos(bA) * Math.sin(angA);
      var angB = time * 0.55 + 2.1, bB = Math.cos(time * 0.42) * 0.9;
      var f2x = Math.cos(bB) * Math.cos(angB), f2y = Math.sin(bB), f2z = Math.cos(bB) * Math.sin(angB);
      var equator = Math.sin(time * 2.2);
      var swirl = P.vortex * 1.5;

      for (var n = 0; n < MO_N; n++) {
        var dx = MO_DX[n], dy = MO_DY[n], dz = MO_DZ[n], u = MO_DU[n];
        var pulse = 0;

        // Program 0 — a band of dots sweeping around the index space.
        if (pw[0] > 0.001) {
          var d0 = Math.abs(n - headA);
          if (d0 > MO_N - d0) d0 = MO_N - d0;
          var v0 = Math.max(0, 1 - d0 / 16);
          pulse = Math.max(pulse, v0 * v0 * pw[0]);
        }
        // Program 1 — two moving specular hot-spots.
        if (pw[1] > 0.001) {
          var v1 = Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28);
          var v2 = Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28);
          var vHot = Math.max(v1, v2);
          pulse = Math.max(pulse, vHot * vHot * pw[1]);
        }
        // Program 2 — a latitude band rising and falling.
        if (pw[2] > 0.001) {
          var band = dy - equator;
          var vBand = Math.max(0, 1 - (band * band) / 0.02);
          pulse = Math.max(pulse, vBand * vBand * pw[2]);
        }
        // Program 3 — a wider, slower sweep, for contrast with program 0.
        if (pw[3] > 0.001) {
          var d3 = Math.abs(n - headB);
          if (d3 > MO_N - d3) d3 = MO_N - d3;
          var v3 = Math.max(0, 1 - d3 / 22);
          pulse = Math.max(pulse, v3 * v3 * pw[3]);
        }

        var level = Math.max(lit[n] * decay, pulse * P.gain);
        lit[n] = level;

        // Dots enter from the top and are the last to leave, so the orb grows
        // upward — the direction the eye expects.
        var keyed = moClamp01(P.k * (1 + S) - S * u);
        if (keyed <= 0.001) {
          colorIndex[n] = -1;
          continue;
        }
        var eased = MO_E.out(keyed);
        var size = eased * P.pop;

        // Yaw, then pitch, then divide-by-z for perspective.
        var x1 = dx * cosYaw + dz * sinYaw;
        var z1 = -dx * sinYaw + dz * cosYaw;
        var y2 = dy * COS_TILT - z1 * SIN_TILT;
        var z2 = dy * SIN_TILT + z1 * COS_TILT;
        var focal = 2.8 / (2.8 - z2);
        var zDepth = (z2 + 1) / 2;

        var ox = x1 * MO_R * size * focal;
        var oy = -y2 * MO_R * size * focal;
        if (swirl > 0.001) {
          // Un-keyed dots get an extra rotation, so the collapse looks like the
          // sphere being wound shut rather than just scaled down.
          var wind = (1 - keyed) * swirl;
          var cosWind = Math.cos(wind), sinWind = Math.sin(wind);
          var tx = ox * cosWind - oy * sinWind;
          oy = ox * sinWind + oy * cosWind;
          ox = tx;
        }

        // The sweep is a green wipe travelling pole to pole during resolve.
        var g = moClamp01((P.sweep * 1.4 - u) / 0.4);
        // Base alpha and the depth term are raised above the component's 0.1 /
        // 0.32. Those were tuned for a 132px orb; this one is 104px, and at the
        // original values the dot cloud washed out to near-invisible against a
        // white message bubble. Same curve, more gain.
        var alpha =
          0.14 +
          0.035 * Math.sin(MO_DS[n] + time * 1.6) * (1 - g) +
          0.4 * zDepth * zDepth +
          0.75 * level * (1 - g) +
          g * (0.55 + 0.4 * zDepth) +
          2 * g * (1 - g); // boost at the wipe's leading edge
        if (alpha < P.floor * (0.7 + 0.3 * zDepth)) alpha = P.floor * (0.7 + 0.3 * zDepth);
        if (alpha > 1) alpha = 1;
        alpha *= eased * P.alpha;

        screenX[n] = centre + ox;
        screenY[n] = centre + oy;
        depth[n] = zDepth;
        // 1.3 rather than the component's 1.15, for the same reason as the alpha
        // above: fewer, slightly larger dots survive the downscale.
        radius[n] =
          (1.3 * (0.45 + 0.75 * zDepth) * focal + 0.9 * level + g * 0.25) *
          (1 + P.rad) *
          (0.4 + 0.6 * eased);
        var ai = Math.round(alpha * MO_A_STEPS);
        var gi = Math.round(g * MO_G_STEPS);
        colorIndex[n] = ai <= 0 ? -1 : gi * (MO_A_STEPS + 1) + ai;
      }

      for (var pass = 0; pass < 2; pass++) {
        for (var i = 0; i < MO_N; i++) {
          var ci = colorIndex[i];
          if (ci < 0) continue;
          if (depth[i] >= 0.5 !== (pass === 1)) continue;
          ctx.fillStyle = MO_COLORS[ci];
          ctx.beginPath();
          ctx.arc(screenX[i], screenY[i], radius[i], 0, MO_TAU);
          ctx.fill();
        }
      }
    }

    function frame(now) {
      raf = 0;
      if (dead) return;
      // Clamp dt: a backgrounded tab returns one enormous delta, which would
      // teleport the light programs and skip the whole animation.
      var dt = isReduced()
        ? 0
        : Math.max(0, Math.min(0.05, (now - last) / 1000)) * getSpeed();
      last = now;
      draw(dt);
      if (P.alpha > 0.002) raf = requestAnimationFrame(frame);
      else if (ctx) ctx.clearRect(0, 0, MO_CANVAS, MO_CANVAS);
    }

    return {
      params: P,
      // Only run the loop while there is something to see. An orb that keeps a
      // rAF alive at alpha 0 would burn battery on every customer site forever.
      wake: function () {
        if (raf || dead || P.alpha <= 0.002) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      },
      reset: function () {
        P.k = 0; P.alpha = 0; P.spin = 0; P.rot = 0; P.sweep = 0;
        P.pop = 1; P.vortex = 0; P.gain = 1; P.floor = 0; P.rad = 0; P.prog = 0;
        lit.fill(0);
        pw[0] = 1; pw[1] = 0; pw[2] = 0; pw[3] = 0;
        time = isReduced() ? 1.2 : 0;
      },
      destroy: function () {
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }

  // ─────────────────────────── timeline engine ───────────────────────────
  // A "track" animates one named channel between two values over a time window
  // with an easing curve. Playing a list of tracks in parallel is how the
  // original sequences its phases; only the CSS application differs here.
  function moTrack(channel, from, to, start, end, ease) {
    return { channel: channel, from: from, to: to, t0: start, t1: end, ease: ease || MO_E.io };
  }

  // Assemble: the cloud keys in from the top, spins up, and pops once as it
  // lands — the pop lands before the key-in finishes, which is what makes it
  // read as impact rather than a fade.
  var MO_ASSEMBLE = [
    moTrack("k", 0, 1, 0, 800, MO_E.out),
    moTrack("alpha", 0, 1, 0, 800, MO_E.out),
    moTrack("spin", 0, 0.9, 0, 800, MO_E.out),
    moTrack("pop", 1, 1.05, 0, 420, MO_E.out),
    moTrack("pop", 1.05, 1, 420, 800, MO_E.io),
  ];

  // Resolve: a green wipe sweeps pole to pole while the spin bleeds off.
  var MO_RESOLVE = [
    moTrack("sweep", 0, 1, 0, 700, MO_E.io),
    moTrack("spin", 0.9, 0.3, 0, 700, MO_E.out),
    moTrack("gain", 1, 0, 0, 700, MO_E.out),
  ];

  // Dissolve: the orb winds shut, collapses and fades, so the reply bubble can
  // take its place. Driven to zero alpha, which stops the rAF loop on its own.
  var MO_DISSOLVE = [
    moTrack("pop", 1, 1.06, 0, 120, MO_E.out),
    moTrack("k", 1, 0, 120, 640, MO_E.vortex),
    moTrack("vortex", 0, 1.6, 120, 640, MO_E.vortex),
    moTrack("alpha", 1, 0, 500, 800, MO_E.out),
  ];

  // Reduced-motion equivalents: cross-fades only, no rotation, no collapse.
  var MO_R_IN = [
    moTrack("alpha", 0, 1, 0, 200, MO_E.out),
    moTrack("k", 0, 1, 0, 200, MO_E.out),
    moTrack("spin", 0, 0, 0, 200, MO_E.out),
  ];
  var MO_R_RESOLVE = [
    moTrack("sweep", 0, 1, 0, 250, MO_E.io),
    moTrack("spin", 0, 0, 0, 250, MO_E.out),
  ];
  var MO_R_OUT = [
    moTrack("alpha", 1, 0, 0, 220, MO_E.out),
    moTrack("sweep", 0, 0, 0, 220, MO_E.out),
  ];

  /**
   * Plays a list of tracks in parallel, one rAF loop, applying each channel
   * through `apply(channel, value)`. Resolves when the last track finishes or
   * the signal aborts. All DOM writes for a frame are batched into one flush,
   * never one per track.
   */
  function moPlay(tracks, speed, isReduced, apply, signal) {
    return new Promise(function (resolve) {
      if (signal && signal.aborted) return resolve();
      var end = tracks.reduce(function (max, track) {
        return Math.max(max, track.t1);
      }, 0);
      var finished = [];
      var raf = 0;
      var elapsed = 0;
      var last = performance.now();

      function onAbort() {
        cancelAnimationFrame(raf);
        signal.removeEventListener("abort", onAbort);
        resolve();
      }
      function complete() {
        signal && signal.removeEventListener("abort", onAbort);
        resolve();
      }
      function step(now) {
        var dt = Math.max(0, Math.min(100, now - last));
        last = now;
        elapsed += dt * speed;
        for (var i = 0; i < tracks.length; i++) {
          var track = tracks[i];
          if (finished[i] || elapsed < track.t0) continue;
          var progress = Math.min(1, (elapsed - track.t0) / Math.max(1, track.t1 - track.t0));
          apply(track.channel, track.from + (track.to - track.from) * track.ease(progress));
          if (progress === 1) finished[i] = true;
        }
        if (elapsed >= end) complete();
        else raf = requestAnimationFrame(step);
      }
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
      raf = requestAnimationFrame(step);
    });
  }

  // ─────────────────────────── the thinking state ───────────────────────────
  var MO_LABELS = ["Thinking", "Searching", "Analyzing", "Composing"];

  /**
   * Mounts a thinking orb inside `node` and returns a controller.
   *
   * `node` is the agent's message bubble. The engine calls `done()` the moment
   * the first token lands, so the orb always yields to the real reply — it is a
   * placeholder, never a second source of truth for the answer.
   */
  function moCreateThinking(node, options) {
    var opts = options || {};
    var speed = typeof opts.speed === "number" ? opts.speed : 1;
    var reducedQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    var reduced = reducedQuery ? reducedQuery.matches : false;

    node.innerHTML =
      '<div class="zy-glow-orb" aria-hidden="true">' +
      '<div class="zy-glow-orb-glow"></div>' +
      '<canvas class="zy-glow-orb-canvas"></canvas>' +
      '<div class="zy-glow-orb-pulse"></div>' +
      "</div>" +
      '<div class="zy-glow-orb-status" role="status" aria-live="polite">' +
      '<span class="zy-glow-orb-label"></span>' +
      '<span class="zy-glow-orb-dots"><i></i><i></i><i></i></span>' +
      "</div>";

    var host = node.querySelector(".zy-glow-orb");
    var canvas = node.querySelector(".zy-glow-orb-canvas");
    var status = node.querySelector(".zy-glow-orb-status");
    var label = node.querySelector(".zy-glow-orb-label");
    if (!host || !canvas || !status || !label) {
      return { done: function () {}, destroy: function () {} };
    }

    var orb = moCreateOrb(canvas, function () { return speed; }, function () { return reduced; });
    var ctl = new AbortController();
    var settled = false;
    var labelTimer = null;

    function setLabel(name) {
      if (label.textContent !== name) label.textContent = name;
    }

    function apply(channel, value) {
      var P = orb.params;
      if (channel === "k") P.k = value;
      else if (channel === "alpha") {
        P.alpha = value;
        host.style.setProperty("--oAlpha", moFmt(value));
        orb.wake();
      } else if (channel === "spin") P.spin = value;
      else if (channel === "sweep") {
        P.sweep = value;
        // Drives the green wash that accompanies the resolve wipe.
        host.style.setProperty("--oGreen", moFmt(value));
      } else if (channel === "pop") P.pop = value;
      else if (channel === "vortex") P.vortex = value;
      else if (channel === "gain") P.gain = value;
      else if (channel === "floor") P.floor = value;
      else if (channel === "rad") P.rad = value;
    }

    // Cycle the status label and the orb's light program together, so the words
    // and the visual stay in step. Reduced motion does not need the loop: the
    // canvas is static there and a rotating label would just be noise.
    if (!reduced) {
      var programIndex = 0;
      labelTimer = setInterval(function () {
        if (settled || ctl.signal.aborted) return;
        programIndex = (programIndex + 1) % 4;
        orb.params.prog = programIndex;
        setLabel(MO_LABELS[programIndex] || MO_LABELS[0]);
      }, 1150 / speed);
    }
    setLabel(MO_LABELS[0]);

    host.style.setProperty("--oAlpha", "0");
    orb.reset();
    moPlay(reduced ? MO_R_IN : MO_ASSEMBLE, speed, reduced, apply, ctl.signal);

    function teardown() {
      if (labelTimer) clearInterval(labelTimer);
      labelTimer = null;
      ctl.abort();
      orb.destroy();
    }

    return {
      /**
       * Called when the answer starts arriving. Sweeps, then dissolves, and only
       * then empties the node — the caller then writes the reply into it.
       */
      done: function () {
        if (settled) return Promise.resolve();
        settled = true;
        if (labelTimer) clearInterval(labelTimer);
        status.setAttribute("aria-live", "off");
        return moPlay(reduced ? MO_R_RESOLVE : MO_RESOLVE, speed, reduced, apply, ctl.signal)
          .then(function () {
            return moPlay(reduced ? MO_R_OUT : MO_DISSOLVE, speed, reduced, apply, ctl.signal);
          })
          .then(function () {
            teardown();
            node.innerHTML = "";
          });
      },
      /** Immediate teardown — error, escalation, or the widget being closed. */
      destroy: function () {
        if (settled) return;
        settled = true;
        teardown();
        node.innerHTML = "";
      },
    };
  }


/* strands — glass orb launcher renderer (Modern Sleek) */
  // ---------------------------------------------------------------------------
  // Strands — WebGL glass-orb launcher for Modern Sleek
  // ---------------------------------------------------------------------------
  // Ported from components/widget/strands-trigger/strands.tsx (a React
  // component). The embeddable widget renders into a Shadow DOM on the host
  // page, where React is not available, so the renderer is kept verbatim and
  // the React lifecycle is replaced with mountStrands(container, options).
  //
  // Trimmed from the component: listening/level (the launcher has no
  // microphone) and lightMode (the launcher is always the dark glass orb).
  // Everything else — the shader, palette roles, motion, reduced-motion
  // handling, context-loss recovery — is unchanged.
  //
  // The launcher is the widget's only always-visible pixel, so it carries the
  // brand: the palette is derived from the domain's accent colour. If the
  // accent is not a hex colour the component's own palette is used instead.

  var STRANDS_MAX_COLORS = 8;
  var STRANDS_ROLES = 7;
  var STRANDS_DEFAULT_COLORS = [
    "#d95b56",
    "#ba5046",
    "#ffa24c",
    "#ffe0b3",
    "#93f1ff",
    "#3569fa",
    "#193d9b",
  ];

  var STRANDS_VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  var STRANDS_FRAG = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uMotion;
uniform float uLevel;
uniform vec3 uColors[8];
uniform int uCount;
uniform float uAmplitude;
uniform float uWaviness;
uniform float uThickness;
uniform float uGlow;
uniform float uTaper;
uniform float uSpread;
uniform float uHueShift;
uniform float uIntensity;
uniform float uSaturation;
uniform float uScale;
uniform float uGlass;
uniform float uRadius;
uniform float uRefraction;
uniform float uDispersion;
uniform float uRim;
uniform vec2 uLean;
uniform float uIntro;
uniform float uPulse;
uniform float uLight;
uniform float uOpacity;

out vec4 fragColor;

const int NB = 10;
const float PI = 3.14159265;

vec3 hueRotate(vec3 c, float a) {
  const mat3 toYiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRgb = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYiq * c;
  float ca = cos(a);
  float sa = sin(a);
  yiq.yz = mat2(ca, sa, -sa, ca) * yiq.yz;
  return max(toRgb * yiq, 0.0);
}

vec3 grade(vec3 c) {
  float g = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(g), c, 1.5 * uSaturation), 0.0, 1.0);
  return hueRotate(c, uHueShift * 6.2831853);
}

vec3 lightInk(vec3 L, float halo, vec3 body) {
  vec3 Lg = grade(L);
  float lum = dot(Lg, vec3(0.2126, 0.7152, 0.0722));
  float cov = 1.0 - exp(-lum * 2.6);
  vec3 hue = Lg / max(max(Lg.r, max(Lg.g, Lg.b)), 1e-4);
  float white = pow(clamp(min(hue.r, min(hue.g, hue.b)), 0.0, 1.0), 1.4);
  vec3 ink = pow(hue, vec3(2.2)) * 0.88;
  float coreAmt = white * smoothstep(0.05, 2.2, lum) * 0.92;
  vec3 cream = mix(mix(uColors[3], vec3(1.0), 0.3), vec3(1.0, 0.985, 0.95), smoothstep(1.2, 3.5, lum));
  vec3 c = mix(body, vec3(0.66, 0.69, 0.76), halo * 0.32);
  c = mix(c, ink, cov * (1.0 - white));
  return mix(c, cream, clamp(coreAmt, 0.0, 1.0));
}

float sstep(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float erfa(float x) {
  float a = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * a);
  float y = 1.0 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-a * a);
  return x < 0.0 ? -y : y;
}

vec3 grad4(vec3 c0, vec3 c1, vec3 c2, vec3 c3, float p1, float p2, float f) {
  vec3 c = mix(c0, c1, sstep(0.0, p1, f));
  c = mix(c, c2, sstep(p1, p2, f));
  return mix(c, c3, sstep(p2, 1.0, f));
}

float smaxk(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(a, b, h) + k * h * (1.0 - h);
}

vec2 sheetW(float tt, float H, float sig, float sigB, float ridges) {
  float ew = 0.04 * uThickness;
  float res0;
  float res1;
  for (int pass = 0; pass < 2; pass++) {
    float sg = pass == 0 ? sig : sigB;
    float fill = 0.5 * (erfa(tt / sg) - erfa((tt - H) / sg)) / H;
    float se = sqrt(sg * sg + 0.25 * ew * ew * H * H);
    float de = (tt - H + 0.5 * ew * H) / se;
    float eg = exp(-de * de) / (se * 1.7724539);
    float rgw = sqrt(sg * sg + 0.0025 * H * H);
    float d1 = (tt - 0.45 * H) / rgw;
    float d2 = (tt - 0.241 * H) / rgw;
    float rid = 0.04 * (exp(-d1 * d1) * step(1.5, ridges) + 0.7 * exp(-d2 * d2) * step(2.5, ridges)) / (rgw * 1.7724539);
    float v = 0.6 * fill * (1.0 - 0.55 * uLight) + (1.6 * ew * 0.886 * eg + rid) * (1.0 + 1.3 * uLight);
    if (pass == 0) res0 = v;
    else res1 = v;
  }
  return vec2(res0, res1);
}

float axis(float x) {
  float a = uAmplitude;
  return -0.2318 + uLean.y * 0.06 + (-0.2394 + uLean.x * 0.1) * x + 0.2815 * a * x * x + 0.3368 * a * x * x * x;
}

float softp(float z) {
  return 0.03 * log(1.0 + exp(clamp(z / 0.03, -60.0, 60.0)));
}

vec3 light(vec2 u, float fp, float bend, float level, out float halo) {
  float amp = level < 0.65 ? mix(0.25, 1.0, sstep(0.0, 0.65, level)) : mix(1.0, 1.12, (level - 0.65) / 0.35);
  float grow = clamp((amp - 0.25) / 0.75, 0.0, 1.25);
  float x = u.x / uScale;
  float uy = u.y;
  float ya = axis(x);
  float taper = max(uTaper, 0.05);
  float bx = 0.0437 + uMotion.z + uLean.x * 0.08;
  float bump = exp(-pow((x - bx) / (0.6879 * taper), 2.0));
  float hW = 0.02 + softp(-0.12 + 0.5324 * uAmplitude * grow * uMotion.y * bump - 0.02);
  float k = 1.0 * uWaviness;
  float cphi = cos(0.5 * PI + k * (x + 0.0664) + uMotion.x);
  float envC = (0.0886 + 0.3 * exp(-pow((x - 0.0634) / 0.6873, 2.0))) * uSpread * grow;
  float hC = -envC * tanh(cphi / 0.6);
  float th = 0.051 * uThickness * exp(-pow(cphi / 0.5, 2.0));
  float sig = sqrt(pow(0.005 + 0.05 * bend, 2.0) + fp * fp + th * th);
  float sigB = sqrt(0.0064 * max(uGlow, 0.05) * max(uGlow, 0.05) + fp * fp + th * th);
  float mend = exp(-pow(abs((x + 0.0421) / (0.4235 * taper)), 2.2689));
  vec3 red = uColors[0];
  vec3 orange = uColors[1];
  vec3 amber = uColors[2];
  vec3 warmWhite = uColors[3];
  vec3 cyan = uColors[4];
  vec3 blue = uColors[5];
  vec3 deep = uColors[6];
  vec3 orangeEdge = orange * vec3(1.0, 0.85, 0.77);
  vec3 coolCore = mix(warmWhite, vec3(1.0, 1.0, 0.7), 0.6);
  vec3 mint = clamp(mix(cyan, warmWhite, 0.35) * vec3(0.92, 1.05, 0.95), 0.0, 1.0);
  float ridges = float(uCount);
  float glow = max(uGlow, 0.0);
  vec3 L = vec3(0.0);
  vec3 Lb = vec3(0.0);
  {
    float H = max(abs(hW), 1e-4);
    float tt = uy - ya;
    vec2 w = sheetW(tt, H, sig, sigB, ridges);
    float f = clamp(tt / H, 0.0, 1.0);
    vec3 c = grad4(warmWhite, amber, orange, orangeEdge, 0.2351, 0.5643, f);
    c = mix(c, red, sstep(0.75, 1.0, f) * sstep(0.196, 0.3376, hW));
    vec3 mean = (grad4(warmWhite, amber, orange, orangeEdge, 0.2351, 0.5643, 0.1) + grad4(warmWhite, amber, orange, orangeEdge, 0.2351, 0.5643, 0.35) + grad4(warmWhite, amber, orange, orangeEdge, 0.2351, 0.5643, 0.6) + grad4(warmWhite, amber, orange, orangeEdge, 0.2351, 0.5643, 0.9)) * 0.25;
    L += mix(c, mean, sstep(0.3, 1.2, sig / H)) * (w.x * 0.2101 * mend);
    Lb += mix(c, mean, sstep(0.3, 1.2, sigB / H)) * (w.y * 0.2101 * mend);
  }
  {
    float H = max(abs(hC), 1e-4);
    float tt = (uy - ya) * (hC >= 0.0 ? 1.0 : -1.0);
    vec2 w = sheetW(tt, H, sig, sigB, 1.0);
    float f = clamp(tt / H, 0.0, 1.0);
    vec3 c = grad4(coolCore, cyan, blue, deep, 0.15, 0.7931, f);
    vec3 mean = (grad4(coolCore, cyan, blue, deep, 0.15, 0.7931, 0.1) + grad4(coolCore, cyan, blue, deep, 0.15, 0.7931, 0.35) + grad4(coolCore, cyan, blue, deep, 0.15, 0.7931, 0.6) + grad4(coolCore, cyan, blue, deep, 0.15, 0.7931, 0.9)) * 0.25;
    L += mix(c, mean, sstep(0.3, 1.2, sig / H)) * (w.x * 0.28 * mend);
    Lb += mix(c, mean, sstep(0.3, 1.2, sigB / H)) * (w.y * 0.28 * mend);
  }
  vec3 G = vec3(0.0);
  float wh = sqrt(0.0256 + envC * envC * cphi * cphi);
  float dg = (uy - ya) / wh;
  G += vec3(1.0, 0.97, 0.92) * (exp(-dg * dg) * 0.0315 / wh * mend * glow);
  float nx = -0.0664 - uMotion.x / k + 0.2168;
  float bxx = (x - nx) / 0.1849;
  float byy = (uy - axis(nx) - 0.0333) / (0.0544 * mix(0.7, 1.0, min(amp, 1.0)));
  G += mint * (exp(-bxx * bxx - byy * byy) * 1.4 * glow * sstep(0.0, 0.6, amp));
  float hb = (uy - ya - 0.3 * hW) / (0.07 + 0.45 * hW + 0.3 * envC);
  halo = exp(-hb * hb) * mend * smoothstep(0.0, 0.3, uIntro);
  vec3 total = L + 0.16 * glow * Lb + 1.16 * G;
  return total * 2.4 * uIntensity * smoothstep(0.0, 0.3, uIntro) * sstep(uIntro * 1.6, uIntro * 1.6 - 0.5, abs(x));
}

vec2 remap(vec2 p, float f, out float r, out float bend) {
  r = min(length(p), 0.9995);
  bend = pow(r, 5.17);
  float k = clamp(uRefraction, 0.0, 1.8);
  float sc = (1.0 - 0.278 * k * (1.0 - bend)) * (1.0 - 0.632 * k * bend) / (1.0 - 0.278 * k);
  return p * sc * f;
}

void main() {
  vec2 res = uResolution;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float level = clamp(uLevel, 0.0, 1.0);
  float appear = smoothstep(0.0, 0.35, uIntro);

  if (uGlass > 0.5) {
    float R = uRadius * mix(0.94, 1.0, uIntro) * (1.0 + 0.03 * uPulse);
    float px = 1.0 / (min(res.x, res.y) * R);
    vec2 pc = p / R;
    float rho = length(pc);
    if (rho > 1.0 + 2.0 * px) {
      float sh = uLight * 0.07 * exp(-pow((rho - 0.985) / 0.07, 2.0)) * smoothstep(-0.6, 0.4, -pc.y) * appear * uOpacity;
      fragColor = vec4(0.0, 0.0, 0.0, sh);
      return;
    }
    float r;
    float bend;
    vec2 u = remap(pc, 1.0, r, bend);
    float fp = 0.5 * max(length(dFdx(u)), length(dFdy(u)));
    float halo;
    float skip;
    vec3 L = light(u, fp, bend, level, halo);
    float ca = 0.02 * uDispersion * bend;
    if (ca > 0.0015) {
      float r2;
      float b2;
      L.r = light(remap(pc, 1.0 - ca, r2, b2), fp, bend, level, skip).r;
      L.b = light(remap(pc, 1.0 + ca, r2, b2), fp, bend, level, skip).b;
    }
    vec3 col = 1.0 - exp(-L);
    vec2 d = pc / max(rho, 1e-6);
    float key = 0.4 * pow(max(0.0, d.x * 0.94 - d.y * 0.34), 6.0) + 0.2 * pow(max(0.0, -d.x * 0.5 + d.y * 0.87), 6.0);
    float ring = exp(-pow((r - 0.985) / 0.011, 2.0));
    float hzk = 0.25 + 0.7 * pow(max(0.0, -d.x * 0.6 + d.y * 0.8), 2.0) + pow(max(0.0, d.x * 0.8 - d.y * 0.6), 2.0);
    float haze = exp(-pow((1.0 - r) / 0.09, 2.0)) * hzk * 0.13 * uRim;
    vec3 orb;
    if (uLight > 0.5) {
      float lz = dot(d * r, vec2(-0.55, 0.83));
      vec3 body = mix(vec3(0.885, 0.893, 0.915), vec3(0.972, 0.975, 0.983), 0.5 + 0.5 * lz);
      float fres = smoothstep(0.8, 1.0, r);
      body = mix(body, vec3(0.82, 0.83, 0.86), fres * fres * 0.5);
      orb = lightInk(L, halo, body);
      float spec = exp(-pow((r - 0.955) / 0.03, 2.0)) * pow(max(0.0, dot(d, vec2(-0.55, 0.83))), 3.0);
      orb = mix(orb, vec3(1.0), clamp(spec * 0.85 * uRim + haze * 0.6, 0.0, 1.0));
      float edge = exp(-pow((1.0 - r) / (0.01 + 1.2 * px), 2.0));
      orb *= 1.0 - 0.12 * edge;
    } else {
      orb = vec3(0.04) + col * (1.0 + 0.1 * bend * uRim) + ring * key * uRim * (1.0 + 0.4 * level) + haze * vec3(1.0, 1.02, 1.04);
      orb = grade(clamp(orb, 0.0, 1.0));
    }
    float inside = clamp((1.0 - rho) / px + 0.5, 0.0, 1.0) * appear;
    vec3 rgb = orb * inside;
    fragColor = vec4(rgb, max(inside * mix(0.92, 1.0, uLight), max(max(rgb.r, rgb.g), rgb.b))) * uOpacity;
  } else {
    float span = 0.5 * res.x / min(res.x, res.y);
    vec2 u = p * (0.78 / span) + vec2(0.0, -0.15);
    float fp = 0.5 * max(length(dFdx(u)), length(dFdy(u)));
    float halo;
    float fade = sstep(0.82, 0.55, abs(u.x));
    vec3 L = light(u, fp, 0.0, level, halo) * fade;
    vec3 col = grade(1.0 - exp(-L)) * appear;
    if (uLight > 0.5) {
      vec3 c = lightInk(L, halo * fade * 0.6, vec3(1.0));
      float a = clamp(1.0 - min(c.r, min(c.g, c.b)), 0.0, 1.0) * appear;
      fragColor = vec4((c - (1.0 - a)) * appear, a) * uOpacity;
    } else {
      fragColor = vec4(col, max(max(col.r, col.g), col.b)) * uOpacity;
    }
  }
}
`;

  function strandsClamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function strandsSmooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function strandsHexToRgb(value) {
    var hex = String(value || "")
      .trim()
      .replace("#", "");
    if (hex.length === 3) hex = hex.replace(/(.)/g, "$1$1");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    var number = parseInt(hex, 16);
    return [
      ((number >> 16) & 255) / 255,
      ((number >> 8) & 255) / 255,
      (number & 255) / 255,
    ];
  }

  function strandsTint(rgb, target, amount) {
    return [
      rgb[0] + (target[0] - rgb[0]) * amount,
      rgb[1] + (target[1] - rgb[1]) * amount,
      rgb[2] + (target[2] - rgb[2]) * amount,
    ];
  }

  function strandsRgbToHex(rgb) {
    return (
      "#" +
      rgb
        .map(function (channel) {
          var value = Math.round(strandsClamp(channel, 0, 1) * 255).toString(16);
          return value.length === 1 ? "0" + value : value;
        })
        .join("")
    );
  }

  /**
   * Maps the domain's accent colour onto the shader's seven palette roles
   * (warm body → warm core → cool body → deep). Falls back to the component's
   * own palette when the accent is not a hex colour.
   */
  function strandsPalette(color) {
    var accent = strandsHexToRgb(color);
    if (!accent) return STRANDS_DEFAULT_COLORS;
    var white = [1, 1, 1];
    var black = [0, 0, 0];
    return [
      strandsRgbToHex(strandsTint(accent, white, 0.08)),
      strandsRgbToHex(accent),
      strandsRgbToHex(strandsTint(accent, white, 0.32)),
      "#fff3dd",
      strandsRgbToHex(strandsTint(accent, white, 0.42)),
      strandsRgbToHex(strandsTint(accent, black, 0.22)),
      strandsRgbToHex(strandsTint(accent, black, 0.5)),
    ];
  }

  function strandsCompile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function strandsCreateProgram(gl) {
    var program = gl.createProgram();
    gl.attachShader(program, strandsCompile(gl, gl.VERTEX_SHADER, STRANDS_VERT));
    gl.attachShader(program, strandsCompile(gl, gl.FRAGMENT_SHADER, STRANDS_FRAG));
    gl.bindAttribLocation(program, 0, "position");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    return program;
  }

  /**
   * Mounts the orb inside `container` (the sleek launcher button).
   * Returns { destroy } or null when WebGL2 is unavailable — in which case the
   * stylesheet keeps the static chat icon as the fallback.
   */
  function mountStrands(container, options) {
    if (!container) return null;
    var settings = options || {};
    var canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    var gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) return null;
    container.appendChild(canvas);

    var config = {
      colors: settings.colors || strandsPalette(settings.color),
      count: 3,
      speed: 1,
      amplitude: 1,
      waviness: 1,
      thickness: 1,
      glow: 1,
      taper: 1,
      spread: 1,
      hueShift: 0,
      intensity: 1,
      saturation: 1,
      opacity: 1,
      scale: 1,
      glass: true,
      refraction: 1,
      dispersion: 1,
      glassSize: 1,
      rim: 1,
      energy: 0.65,
      interactive: true,
      clickPulse: true,
      intro: true,
      maxDevicePixelRatio: 2,
    };

    var program = null;
    var buffer = null;
    var loc = {};
    var names = [
      "uResolution",
      "uMotion",
      "uLevel",
      "uColors",
      "uCount",
      "uAmplitude",
      "uWaviness",
      "uThickness",
      "uGlow",
      "uTaper",
      "uSpread",
      "uHueShift",
      "uIntensity",
      "uSaturation",
      "uScale",
      "uGlass",
      "uRadius",
      "uRefraction",
      "uDispersion",
      "uRim",
      "uLean",
      "uIntro",
      "uPulse",
      "uLight",
      "uOpacity",
    ];

    var setup = function () {
      var next = strandsCreateProgram(gl);
      if (!next) return false;
      program = next;
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.useProgram(next);
      loc = {};
      names.forEach(function (name) {
        loc[name] = gl.getUniformLocation(next, name);
      });
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      return true;
    };
    if (!setup()) {
      canvas.remove();
      return null;
    }

    var query =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    var state = {
      clock: 0,
      pace: 0,
      activity: 0,
      hover: 0,
      hoverTarget: 0,
      burst: 0,
      lean: [0, 0],
      leanTarget: [0, 0],
      pulse: 0,
      pulseV: 0,
      introStart: -1,
      intro: config.intro ? 0 : 1,
      visible: typeof IntersectionObserver === "undefined",
      lost: false,
      raf: 0,
      last: 0,
      width: 0,
      height: 0,
      paletteKey: "",
      palette: { flat: new Float32Array(STRANDS_MAX_COLORS * 3), count: 1 },
    };

    var resize = function () {
      var dpr = Math.min(
        window.devicePixelRatio || 1,
        Math.max(0.5, config.maxDevicePixelRatio),
      );
      var width = Math.max(1, Math.round(container.clientWidth * dpr));
      var height = Math.max(1, Math.round(container.clientHeight * dpr));
      if (width !== state.width || height !== state.height) {
        state.width = width;
        state.height = height;
        canvas.width = width;
        canvas.height = height;
      }
    };

    var updatePalette = function (list) {
      var key = list.join(",");
      if (key === state.paletteKey) return;
      state.paletteKey = key;
      var rgb = (list.length ? list : STRANDS_DEFAULT_COLORS)
        .slice(0, STRANDS_MAX_COLORS)
        .map(strandsHexToRgb);
      var flat = new Float32Array(STRANDS_MAX_COLORS * 3);
      for (var roleIndex = 0; roleIndex < STRANDS_ROLES; roleIndex++) {
        var position =
          rgb.length > 1
            ? (roleIndex / (STRANDS_ROLES - 1)) * (rgb.length - 1)
            : 0;
        var lower = Math.floor(position);
        var upper = Math.min(lower + 1, rgb.length - 1);
        var fraction = position - lower;
        var mixed = rgb[lower].map(function (channel, channelIndex) {
          return channel + (rgb[upper][channelIndex] - channel) * fraction;
        });
        flat.set(mixed, roleIndex * 3);
      }
      state.palette = { flat: flat, count: STRANDS_ROLES };
    };

    var draw = function () {
      if (state.lost || !program) return;
      updatePalette(Array.isArray(config.colors) ? config.colors : []);
      gl.viewport(0, 0, state.width, state.height);
      gl.uniform2f(loc.uResolution, state.width, state.height);
      var clock = state.clock;
      var sway = 0.75 + 0.45 * state.pace;
      gl.uniform3f(
        loc.uMotion,
        (0.26 * Math.sin(0.53 * clock) + 0.1 * Math.sin(1.19 * clock + 1.3)) *
          sway,
        1 +
          (0.06 * Math.sin(0.71 * clock) +
            0.035 * Math.sin(1.37 * clock + 0.4)) *
            sway,
        0.06 * Math.sin(0.41 * clock + 2) * sway,
      );
      gl.uniform1f(loc.uLevel, strandsClamp(state.activity, 0, 1));
      gl.uniform3fv(loc.uColors, state.palette.flat);
      gl.uniform1i(
        loc.uCount,
        strandsClamp(Math.round(config.count), 1, 3),
      );
      gl.uniform1f(loc.uAmplitude, config.amplitude);
      gl.uniform1f(loc.uWaviness, config.waviness);
      gl.uniform1f(loc.uThickness, config.thickness);
      gl.uniform1f(loc.uGlow, config.glow);
      gl.uniform1f(loc.uTaper, Math.max(0.05, config.taper));
      gl.uniform1f(loc.uSpread, config.spread);
      gl.uniform1f(loc.uHueShift, config.hueShift);
      gl.uniform1f(loc.uIntensity, config.intensity);
      gl.uniform1f(loc.uSaturation, config.saturation);
      gl.uniform1f(loc.uScale, Math.max(0.05, config.scale));
      gl.uniform1f(loc.uGlass, config.glass ? 1 : 0);
      gl.uniform1f(loc.uRadius, 0.42 * config.glassSize);
      gl.uniform1f(loc.uRefraction, config.refraction);
      gl.uniform1f(loc.uDispersion, config.dispersion);
      gl.uniform1f(loc.uRim, config.rim);
      gl.uniform2f(loc.uLean, state.lean[0], state.lean[1]);
      gl.uniform1f(loc.uIntro, state.intro);
      gl.uniform1f(loc.uPulse, state.pulse);
      gl.uniform1f(loc.uLight, 0);
      gl.uniform1f(loc.uOpacity, config.opacity);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    var frame = function (now) {
      state.raf = 0;
      var dt = state.last ? strandsClamp((now - state.last) / 1000, 0, 0.05) : 0;
      state.last = now;
      var reduced = !!query && query.matches;
      if (state.introStart < 0 && state.visible) state.introStart = now;
      if (config.intro && !reduced && state.introStart >= 0) {
        var progress = strandsClamp((now - state.introStart) / 1400, 0, 1);
        state.intro = 1 - Math.pow(1 - progress, 3);
      } else {
        state.intro = 1;
      }
      state.hover +=
        (state.hoverTarget - state.hover) *
        (1 -
          Math.exp(
            -dt / (state.hoverTarget > state.hover ? 0.25 : 0.6),
          ));
      for (var axisIndex = 0; axisIndex < 2; axisIndex++) {
        state.lean[axisIndex] +=
          (state.leanTarget[axisIndex] - state.lean[axisIndex]) *
          (1 - Math.exp(-dt / 0.35));
      }
      state.pulseV += (-170 * state.pulse - 14 * state.pulseV) * dt;
      state.pulse += state.pulseV * dt;
      state.burst *= Math.exp(-dt / 0.45);
      var target = Math.min(
        1.2,
        Math.max(
          strandsClamp(config.energy, 0, 1),
          state.hover * 0.18 + state.burst,
        ),
      );
      state.activity +=
        (target - state.activity) *
        (1 - Math.exp(-dt / (target > state.activity ? 0.12 : 0.4)));
      state.pace +=
        (Math.min(1, state.activity) - state.pace) *
        (1 - Math.exp(-dt / 0.8));
      if (!reduced) {
        state.clock += dt * config.speed * (0.6 + 1.6 * state.pace);
      }
      draw();
      var settled =
        reduced &&
        Math.abs(state.activity - target) < 1e-3 &&
        Math.abs(state.pulse) < 1e-3 &&
        Math.abs(state.pulseV) < 1e-3 &&
        state.burst < 1e-3 &&
        Math.abs(state.hover - state.hoverTarget) < 1e-3 &&
        Math.abs(state.lean[0] - state.leanTarget[0]) < 1e-3 &&
        Math.abs(state.lean[1] - state.leanTarget[1]) < 1e-3;
      if (
        state.visible &&
        !document.hidden &&
        !state.lost &&
        !settled
      ) {
        state.raf = requestAnimationFrame(frame);
      }
    };

    var wake = function () {
      if (!state.raf && state.visible && !state.lost) {
        state.last = 0;
        state.raf = requestAnimationFrame(frame);
      }
    };

    var localPoint = function (event) {
      var rect = container.getBoundingClientRect();
      var unit = Math.min(rect.width, rect.height) || 1;
      return [
        (event.clientX - rect.left - rect.width / 2) / (unit / 2),
        (event.clientY - rect.top - rect.height / 2) / (unit / 2),
      ];
    };

    var onMove = function (event) {
      if (!config.interactive) return;
      var point = localPoint(event);
      state.hoverTarget = strandsClamp(
        1.6 - Math.hypot(point[0], point[1]),
        0,
        1,
      );
      state.leanTarget = [
        strandsClamp(point[0], -1.2, 1.2) * 0.8,
        strandsClamp(-point[1], -1.2, 1.2) * 0.8,
      ];
      wake();
    };

    var onLeave = function () {
      state.hoverTarget = 0;
      state.leanTarget = [0, 0];
      wake();
    };

    var onDown = function () {
      if (!config.clickPulse) return;
      state.pulseV += 5;
      state.burst = Math.min(1.2, state.burst + 0.9);
      wake();
    };

    var onLost = function (event) {
      event.preventDefault();
      state.lost = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    };

    var onRestored = function () {
      state.lost = false;
      if (setup()) wake();
    };

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("pointerdown", onDown);

    var resizeObserver = new ResizeObserver(function () {
      resize();
      draw();
    });
    resizeObserver.observe(container);
    resize();

    var intersection = null;
    if (typeof IntersectionObserver !== "undefined") {
      intersection = new IntersectionObserver(function (entries) {
        state.visible = entries[entries.length - 1].isIntersecting;
        if (state.visible) wake();
      });
      intersection.observe(container);
    }
    var onVisibility = function () {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVisibility);
    wake();

    // Tells the stylesheet to drop the static chat icon behind the orb.
    container.classList.add("zy-strands");

    return {
      destroy: function () {
        if (state.raf) cancelAnimationFrame(state.raf);
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerleave", onLeave);
        container.removeEventListener("pointerdown", onDown);
        document.removeEventListener("visibilitychange", onVisibility);
        resizeObserver.disconnect();
        if (intersection) intersection.disconnect();
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        var loseContext = gl.getExtension("WEBGL_lose_context");
        if (loseContext) loseContext.loseContext();
        canvas.remove();
        container.classList.remove("zy-strands");
      },
    };
  }


/* base styles — panel, header, messages, composer, chips */
var BASE_CSS = `
/* ---- Reset & base ----
   The theme tokens are private aliases (--_zy-*) that read the public names
   (--zy-*). Declaring a custom property from itself — \`--zy-muted:
   var(--zy-muted, #64748b)\` — is a cycle: it resolves to nothing at all, and
   every colour that used it silently fell back to the inherited black. The
   alias breaks the cycle while still letting a page override the widget by
   setting --zy-* on the <zy-widget> element. */
:host {
  --_zy-color: var(--zy-color, #10b981);
  --_zy-text: var(--zy-text, #0f172a);
  --_zy-muted: var(--zy-muted, #64748b);
  --_zy-bg: var(--zy-bg, #ffffff);
  --_zy-border: var(--zy-border, #e2e8f0);
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
  color: var(--_zy-text);
}
.zy-wrap[data-position="bottom-left"] { left: 20px; right: auto; align-items: flex-start; }
.zy-wrap[data-position="bottom-right"] { right: 20px; left: auto; }

/* ---- Launcher — the floating chat bubble that toggles the panel open/closed ---- */
.zy-launcher {
  width: 58px;
  height: 58px;
  border: none;
  border-radius: 50%;
  background: var(--_zy-color);
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

/* ---- Launcher tooltip ---- */
/* A small chip beside the launcher ("Chat with us" by default), editable per
   domain. The engine injects it for every launcher, whoever owns the button:
   never picked a trigger included. It is the wrap's LAST child — its previous
   sibling is therefore always the launcher; positioning anchors from that
   pairing, which is also why it lives outside the launcher (some launchers
   clip their contents). Decorative (aria-hidden): the launcher's aria-label
   stays the single annotation a screen reader hears.
   Modes (data-tip on .zy-wrap):
     "hover"  — shows on mouse-over (touch screens never hover: free)
     "always" — permanently on, the classic chip-and-bubble combo */
.zy-tip {
  position: absolute;
  bottom: 12px;
  right: calc(100% + 10px);
  max-width: 176px;
  padding: 7px 12px;
  border-radius: 10px;
  background: #0f172a;
  color: #fff;
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transform: translateX(3px);
  transition: opacity 0.16s ease, transform 0.16s ease;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
}
.zy-wrap[data-position="bottom-left"] .zy-tip {
  right: auto;
  left: calc(100% + 10px);
  transform: translateX(-3px);
}
.zy-wrap[data-tip="hover"] .zy-launcher:hover + .zy-tip,
.zy-wrap[data-tip="always"] .zy-tip {
  opacity: 1;
  transform: translateX(0);
}
/* An open chat must not have the chip floating over its messages. */
.zy-wrap[data-open="true"] .zy-tip { display: none; }

/* ---- Chat panel — the main chat window ---- */
/* Hidden by default (display: none). Shown when data-open="true" on .zy-wrap. */
.zy-panel {
  width: 382px;
  max-width: calc(100vw - 32px);
  height: 620px;
  max-height: min(80vh, 700px);
  background: var(--_zy-bg);
  border: 1px solid var(--_zy-border);
  border-radius: var(--zy-radius);
  box-shadow: var(--zy-shadow);
  display: none;
  flex-direction: column;
  overflow: hidden;
}
.zy-wrap[data-open="true"] .zy-panel { display: flex; }

/* ---- Header — agent name, description, online status, mobile close button ---- */
.zy-header {
  background: var(--_zy-color);
  color: #fff;
  padding: 14px 16px;
  flex-shrink: 0;
  position: relative; /* anchor for the absolute-positioned close button */
}
.zy-header-title { font-weight: 650; font-size: 16px; letter-spacing: -0.01em; padding-right: 36px; /* room for close btn */ }
.zy-header-logo {
  display: block;
  width: 30px;
  height: 30px;
  margin-bottom: 8px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  object-fit: contain;
}
.zy-header-logo[hidden] { display: none; }
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
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.zy-messages::-webkit-scrollbar { display: none; }
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
.zy-msg-agent { background: #fff; border: 1px solid var(--_zy-border); border-bottom-left-radius: 5px; align-self: flex-start; }
/* Owner (human support) messages — left-aligned, accent border, labeled */
.zy-msg-owner { background: #fff; border: 1px solid var(--_zy-color); border-bottom-left-radius: 5px; align-self: flex-start; }
.zy-msg-owner::before { content: "Owner"; display: block; font-size: 11px; font-weight: 600; color: var(--_zy-color); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
/* User (visitor) messages — right-aligned, accent background, white text */
.zy-msg-user { background: var(--_zy-color); color: #fff; border-bottom-right-radius: 5px; align-self: flex-end; }
/* Error messages — centered, red background */
.zy-msg-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; align-self: center; font-size: 13px; }
/* ---- Markdown inside agent bubbles (renderMd in helpers.js) ----
   Block elements replaced the old <br>-only rendering; the global reset
   zeroes margins, so spacing is re-established here. */
.zy-msg p { margin: 0; }
.zy-msg > * + * { margin-top: 6px; }
.zy-msg ul, .zy-msg ol { padding-left: 20px; }
.zy-msg li + li { margin-top: 3px; }
.zy-msg a { color: var(--_zy-color); text-decoration: underline; text-underline-offset: 2px; }
.zy-msg code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: rgba(15, 23, 42, 0.06); border-radius: 4px; padding: 1px 4px; }
.zy-msg pre { background: #f1f5f9; border-radius: 8px; padding: 8px 10px; overflow-x: auto; }
.zy-msg pre code { background: none; padding: 0; font-size: 12.5px; }
.zy-msg blockquote { border-left: 3px solid var(--_zy-border); padding-left: 10px; color: var(--_zy-muted); }
.zy-msg .zy-md-h { font-weight: 650; }
.zy-msg .zy-md-hr { border: 0; border-top: 1px solid var(--_zy-border); }
.zy-product-card { width: min(100%, 290px); display: flex; gap: 10px; align-items: center; align-self: flex-start; overflow: hidden; border: 1px solid var(--_zy-border); border-radius: 12px; background: #fff; padding: 8px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08); animation: zy-in 0.16s ease; }
.zy-product-image { width: 64px; height: 64px; flex: 0 0 64px; border-radius: 8px; object-fit: cover; background: #eef2f7; }
.zy-product-details { min-width: 0; }
.zy-product-name { font-size: 13px; font-weight: 650; overflow-wrap: anywhere; }
.zy-product-price { margin-top: 2px; color: var(--_zy-muted); font-size: 12.5px; font-weight: 600; }
.zy-product-link { display: inline-flex; margin-top: 6px; color: var(--_zy-color); font-size: 12px; font-weight: 650; text-decoration: underline; text-underline-offset: 2px; }
.zy-product-link:hover { text-decoration: none; }
.zy-product-link:focus-visible { outline: 2px solid var(--_zy-color); outline-offset: 2px; }
/* Typing indicator — bouncing dots while waiting for AI response */
.zy-msg-typing { padding: 9px 13px; }
.zy-typing-dots { display: inline-flex; align-items: center; gap: 12%; }
.zy-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--_zy-color);
  animation: zy-bounce 1.4s ease-in-out infinite;
}
.zy-dot:nth-child(2) { animation-delay: 0.2s; }
.zy-dot:nth-child(3) { animation-delay: 0.4s; }

/* ---- Composer ----
 * Shared shell, promoted out of variants/classic.css: every variant needs a
 * working input and send button, and the theming below is driven by --zy-color
 * and --zy-border, which are per-domain. A variant overrides what it wants to
 * change rather than re-declaring the structure.
 *
 * Expanding pill composer. Collapsed it is a single rounded row; on focus
 * (or once the visitor types) the capability row fades in below it.
 *
 * The expand/collapse uses grid-template-rows 0fr -> 1fr rather than an
 * animated height: it needs no magic numbers and stays correct when the
 * chip labels wrap on a narrow widget.
 *
 * Placeholder letters are animated with a CSS keyframe plus a per-index
 * animation-delay, so the blur-in stagger costs nothing at runtime and
 * needs no animation library inside the shadow root.
 */
.zy-composer {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--_zy-border);
  background: #fff;
  flex-shrink: 0;
}
.zy-composer-shell {
  border: 1px solid var(--_zy-border);
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.zy-composer-shell:focus-within,
.zy-composer-shell[data-expanded="true"] {
  border-color: color-mix(in srgb, var(--_zy-color) 55%, var(--_zy-border));
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.08);
}

/* Row 1 — input + send */
.zy-composer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 14px;
}
.zy-composer-field {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.zy-composer input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: 8px 0;
  font-size: 14.5px;
  font-family: inherit;
  color: var(--_zy-text);
  position: relative;
  z-index: 1;
}
/* Placeholder sits under the real input and is never focusable. It is drawn at
   half strength: it is a hint, not content, and the visitor's own text must
   always win the eye. */
.zy-composer-ph {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 0.16s ease;
}
/* Once the visitor is in the field — focused, or typing — the hint goes, so
   their words never sit on top of it. */
.zy-composer[data-ph-hidden="true"] .zy-composer-ph {
  opacity: 0;
}
.zy-composer-ph span {
  display: inline-block;
  white-space: nowrap;
  color: color-mix(in srgb, var(--_zy-muted) 50%, transparent);
  font-size: 14.5px;
  font-family: inherit;
  animation: zy-ph-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--zy-ph-delay, 0ms);
}
@keyframes zy-ph-in {
  from { opacity: 0; filter: blur(7px); transform: translateY(6px); }
  to   { opacity: 1; filter: blur(0);   transform: none; }
}
@keyframes zy-ph-out {
  from { opacity: 1; filter: blur(0);   transform: none; }
  to   { opacity: 0; filter: blur(7px); transform: translateY(-6px); }
}
.zy-composer-ph[data-leaving="true"] span {
  animation: zy-ph-out 0.3s ease forwards;
  animation-delay: var(--zy-ph-delay, 0ms);
}

.zy-send {
  border: none;
  border-radius: 50%;
  background: var(--_zy-color);
  color: #fff;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.zy-send:hover:not(:disabled) { transform: translateY(-1px); }
.zy-send:disabled { opacity: 0.4; cursor: not-allowed; }
.zy-send svg { width: 17px; height: 17px; }

.zy-probe { color: red; }

/* ---- Footer note ---- */
.zy-note { padding: 0 16px 12px; font-size: 12px; color: var(--_zy-muted); text-align: center; flex-shrink: 0; background: #fff; border-top: 1px solid var(--_zy-border); }

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
  /* When the panel is open on mobile, anchor it to the top of the VISIBLE
     screen — not the layout viewport. See _watchVisualViewport in engine.js:
     the keyboard overlays the bottom of the layout viewport without shrinking
     it, so a plain 100dvh-tall panel is taller than the area above the
     keyboard and the browser's pan parks the header off the top of the
     screen. --zy-vv-top is the layout offset of the visible area and
     --zy-vvh its height, written from window.visualViewport; the fallbacks
     keep the previous behaviour on browsers without that API. */
  .zy-wrap[data-open="true"] {
    top: var(--zy-vv-top, 0px);
    bottom: auto;
    height: var(--zy-vvh, 100dvh);
  }
  .zy-wrap[data-open="true"] .zy-panel { height: 100%; max-height: 100%; }
  /* Keep the launcher as a floating bubble at the bottom */
  .zy-launcher { position: fixed; right: 16px; bottom: 16px; }
  .zy-wrap[data-position="bottom-left"] .zy-launcher { left: 16px; right: auto; }
  /* When panel is open on mobile: hide the floating launcher (it would overlap
     the send button), show the header close button instead */
  .zy-wrap[data-open="true"] .zy-launcher { display: none; }
  .zy-header-close { display: flex; }
  /* Drop the "Powered by Ziyarn" footer on mobile to free vertical space. */
  .zy-note { display: none; }
}
`;

/* variant stylesheets — keyed by id */
var VARIANT_CSS = {
  "classic": `
/* =========================================================================
   Classic — the default appearance
   =========================================================================
   Classic is the reference look, so it has almost nothing left to declare: the
   panel, header, messages, composer and chips all live in base.css, themed
   entirely through --zy-color and --zy-border. That is deliberate — it means a
   per-domain accent colour re-themes the whole widget with no variant involved,
   and a new variant starts from a working widget instead of a blank panel.

   What lives here is only what is genuinely Classic-specific:

     1. The composer focus treatment. Base gives a soft accent border; Classic
        makes that border a touch stronger, which suits its flat, quiet look.
     2. The launcher. Base draws a filled circle; Classic flattens its shadow.

   Everything else in a variant is a departure FROM this baseline. See
   variants/glow.css for a substantially different treatment.

   Adding a variant that wants a different composer does not need to redeclare
   the structure — override the specific properties.
   ------------------------------------------------------------------------- */

.zy-wrap[data-variant="classic"] .zy-composer-shell:focus-within,
.zy-wrap[data-variant="classic"] .zy-composer-shell[data-expanded="true"] {
  border-color: color-mix(in srgb, var(--_zy-color) 68%, var(--_zy-border));
}

.zy-wrap[data-variant="classic"] .zy-launcher {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
`,
  "glow": `
/* =========================================================================
   Glow — the orb-led widget variant
   =========================================================================
   Reconstructed for the Ziyarn widget. The upstream component's stylesheet was
   unavailable, so these rules are written against the same contract the ported
   orb writes to: the orb sets --oAlpha and --oGreen on its host element, and
   everything visual follows from those two numbers.

   Provenance: the @keyframes below (mo-drift, mo-dot, mo-in, mo-out,
   mo-fade-in, mo-fade-out, mo-shake, mo-spin, mo-shimmer) are the upstream
   component's, unchanged. The selectors around them are Ziyarn's.

   The upstream component styled a full-viewport hero. Here the same visual
   language is compressed into a 382px chat panel, so the effects are scaled
   down and clipped rather than removed.
   ------------------------------------------------------------------------- */

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes mo-spin { to { --angle: 360deg; } }
@keyframes mo-drift { from { transform: translateX(-14%); } to { transform: translateX(14%); } }
@keyframes mo-shimmer { from { background-position: 150% 0; } to { background-position: -100% 0; } }
@keyframes mo-dot {
  0%, 80%, 100% { opacity: 0.25; }
  40% { opacity: 1; }
}
@keyframes mo-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes mo-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-6px); } }
@keyframes mo-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes mo-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes mo-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
@keyframes mo-breathe {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.06); }
}

/* ---- Panel: an aurora bleeding down from the header ---- */
/* position:relative is load-bearing: without it .zy-aurora's absolute
   positioning resolves against .zy-wrap (the fixed viewport anchor) instead of
   the panel, and the wash lands in the wrong place entirely. */
.zy-wrap[data-variant="glow"] .zy-panel {
  position: relative;
  background: linear-gradient(180deg, #eafff5 0%, #ffffff 30%);
  border-color: rgba(16, 185, 129, 0.22);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 18px 44px -12px rgba(16, 185, 129, 0.3);
}
/* Three blurred blobs on a slow, offset drift. Kept behind the content with
   z-index 0 and clipped by the panel's own overflow:hidden, so it can never
   bleed over the composer or escape the panel's rounded corners. Sized for a
   382px panel rather than the component's full-width hero. */
.zy-aurora {
  position: absolute;
  inset: 0 0 auto 0;
  height: 190px;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  /* Fade the wash out as it descends, so it reads as light spilling from the
     header rather than a band with a hard bottom edge. */
  -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.45) 55%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0.45) 55%, transparent 100%);
}
.zy-aurora i {
  position: absolute;
  display: block;
  border-radius: 50%;
  filter: blur(30px);
  opacity: 0.7;
}
.zy-aurora i:nth-child(1) {
  width: 150px; height: 150px; top: -84px; left: -38px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.62), transparent 68%);
  animation: mo-drift 9s ease-in-out infinite alternate;
}
.zy-aurora i:nth-child(2) {
  width: 132px; height: 132px; top: -64px; right: -44px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.58), transparent 68%);
  animation: mo-drift 12s ease-in-out infinite alternate-reverse;
}
.zy-aurora i:nth-child(3) {
  width: 118px; height: 118px; top: -26px; left: 36%;
  background: radial-gradient(circle, rgba(253, 186, 116, 0.38), transparent 70%);
  animation: mo-drift 15s ease-in-out infinite alternate;
  animation-delay: -4s;
}

/* Content sits above the aurora. */
.zy-wrap[data-variant="glow"] .zy-header,
.zy-wrap[data-variant="glow"] .zy-messages,
.zy-wrap[data-variant="glow"] .zy-note,
.zy-wrap[data-variant="glow"] .zy-composer {
  position: relative;
  z-index: 1;
}

.zy-wrap[data-variant="glow"] .zy-header {
  background: linear-gradient(135deg, #059669 0%, #10b981 52%, #2dd4bf 100%);
  box-shadow: 0 6px 18px -8px rgba(5, 150, 105, 0.55);
}
.zy-wrap[data-variant="glow"] .zy-messages { background: transparent; }
.zy-wrap[data-variant="glow"] .zy-note { background: transparent; border-top-color: rgba(16, 185, 129, 0.16); }

/* ---- Messages: agent replies pick up a faint emerald tint ---- */
.zy-wrap[data-variant="glow"] .zy-msg-agent {
  background: rgba(236, 253, 245, 0.92);
  border-color: rgba(16, 185, 129, 0.2);
}
.zy-wrap[data-variant="glow"] .zy-msg-user {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  box-shadow: 0 4px 12px -4px rgba(5, 150, 105, 0.5);
}

/* ---- Composer: a rotating conic ring on focus ---- */
/* Uses the upstream mo-spin keyframe, which animates the registered --angle
   custom property — that registration is why @property is declared above. */
.zy-wrap[data-variant="glow"] .zy-composer-shell {
  border: 1px solid rgba(16, 185, 129, 0.24);
  background: #fff;
  transition: box-shadow 0.22s ease, border-color 0.22s ease;
}
.zy-wrap[data-variant="glow"] .zy-composer[data-expanded="true"] .zy-composer-shell,
.zy-wrap[data-variant="glow"] .zy-composer-shell:focus-within {
  border-color: transparent;
  background:
    linear-gradient(#fff, #fff) padding-box,
    conic-gradient(from var(--angle), #10b981, #2dd4bf, #fcd34d, #10b981) border-box;
  border: 1px solid transparent;
  animation: mo-spin 3.2s linear infinite;
  box-shadow: 0 6px 20px -8px rgba(16, 185, 129, 0.5);
}
.zy-wrap[data-variant="glow"] .zy-send {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
}
.zy-wrap[data-variant="glow"] .zy-send:disabled { background: #a7f3d0; color: #34d399; }
/* =========================================================================
   Thinking orb — the variant's stand-in for the typing dots
   =========================================================================
   Two custom properties drive everything, both written by the ported orb:
     --oAlpha  0 → 1 as the orb keys in, 1 → 0 as it dissolves
     --oGreen  0 → 1 during the resolve wipe
   ========================================================================= */
.zy-wrap[data-variant="glow"] .zy-msg-typing {
  align-self: center;
  background: transparent;
  border: none;
  padding: 10px 16px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.zy-glow-orb {
  --oAlpha: 0;
  --oGreen: 0;
  position: relative;
  width: 176px;
  height: 176px;
  display: grid;
  place-items: center;
  opacity: var(--oAlpha);
  transition: opacity 0.18s linear;
}
/* The bloom under the orb. Scales and saturates with the resolve wipe, so the
   green flash is the orb's own state rather than a separate animation. */
.zy-glow-orb-glow {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(16, 185, 129, 0.62) 0%,
    rgba(45, 212, 191, 0.3) 44%,
    transparent 72%
  );
  filter: blur(14px);
  transform: scale(calc(0.8 + var(--oGreen) * 0.34));
  opacity: calc(0.5 + var(--oGreen) * 0.5);
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.zy-glow-orb-canvas {
  position: relative;
  width: 176px;
  height: 176px;
  display: block;
}
/* A single expanding ring, fired once on resolve. */
.zy-glow-orb-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(16, 185, 129, 0.55);
  opacity: 0;
  transform: scale(0.7);
}
.zy-glow-orb-pulse[data-fire="true"] { animation: mo-ring 0.9s ease-out forwards; }
@keyframes mo-ring {
  0% { opacity: 0.9; transform: scale(0.7); }
  100% { opacity: 0; transform: scale(1.32); }
}

.zy-glow-orb-status {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: #047857;
  animation: mo-in 0.32s ease both;
}
.zy-glow-orb-dots { display: inline-flex; gap: 3px; }
.zy-glow-orb-dots i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #10b981;
  animation: mo-dot 1.25s ease-in-out infinite;
}
.zy-glow-orb-dots i:nth-child(2) { animation-delay: 0.16s; }
.zy-glow-orb-dots i:nth-child(3) { animation-delay: 0.32s; }

/* ---- Reduced motion: hold the orb still, keep it legible ---- */
/* The ported engine already cross-fades instead of rotating. This strips the
   decorative ambient loops so nothing moves indefinitely. */
@media (prefers-reduced-motion: reduce) {
  .zy-aurora i { animation: none; opacity: 0.4; }
  .zy-wrap[data-variant="glow"] .zy-composer-shell:focus-within,
  .zy-wrap[data-variant="glow"] .zy-composer[data-expanded="true"] .zy-composer-shell {
    animation: none;
    background: linear-gradient(#fff, #fff) padding-box, #10b981 border-box;
  }
  .zy-glow-orb-dots i { animation: none; opacity: 0.7; }
  .zy-glow-orb-status { animation: mo-fade-in 0.2s ease both; }
}

/* ---- Mobile ---- */
@media (max-width: 480px) {
  .zy-glow-orb, .zy-glow-orb-canvas { width: 152px; height: 152px; }
  .zy-glow-orb-glow { inset: 10px; }
}
`,
  "sleek": `
/* Modern Sleek — the chat itself lives in /embed/<slug>; the script only owns
   the launcher and the full-screen frame. Scoped under data-variant so these
   rules cannot reach Classic or Glow. */
.zy-wrap[data-variant="sleek"] .zy-sleek-overlay {
  position: fixed;
  inset: 0;
  z-index: 2;
  /* No veil: the chat floats directly over the host page, with no tint and
     no frost behind it. The overlay only positions the frame. */
}

.zy-wrap[data-variant="sleek"] .zy-sleek-overlay[hidden] {
  display: none;
}

.zy-wrap[data-variant="sleek"] .zy-sleek-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  /* Transparent so the embed page paints the widget; the overlay behind it
     has no tint of its own. */
  background: transparent;
}

/* The launcher is the Strands glass orb, not a tinted disc: the orb paints
   itself (and its own drop shadow) onto the canvas inside the button. The
   button keeps the size and hit area; the chat glyph stays as the fallback
   for browsers without WebGL2, where mountStrands returns null. */
.zy-wrap[data-variant="sleek"] .zy-launcher {
  position: relative;
  width: 72px;
  height: 72px;
  padding: 0;
}
.zy-wrap[data-variant="sleek"] .zy-launcher.zy-strands {
  background: transparent;
  box-shadow: none;
}
.zy-wrap[data-variant="sleek"] .zy-launcher.zy-strands:hover {
  box-shadow: none;
}
.zy-wrap[data-variant="sleek"] .zy-launcher.zy-strands .zy-open,
.zy-wrap[data-variant="sleek"] .zy-launcher.zy-strands .zy-close {
  display: none;
}

/* The frame covers the viewport, so the launcher would only sit on top of it. */
.zy-wrap[data-variant="sleek"][data-open="true"] .zy-launcher {
  display: none;
}

/* Mobile: the overlay clings to the VISIBLE screen rather than the layout
   viewport. The engine mirrors window.visualViewport into --zy-vv-top /
   --zy-vvh (see _watchVisualViewport), so when the software keyboard opens
   the frame shrinks and slides with it — instead of its top edge leaving the
   screen. The embed page inside the frame sizes itself from the frame, so
   its own dvh units recompute against the resized frame automatically. */
@media (max-width: 480px) {
  .zy-wrap[data-variant="sleek"][data-open="true"] .zy-sleek-overlay {
    /* Hairline inset: the chat sheet is a card lifted 2px off the phone's
       top and side edges. The bottom edge stays flush with the mirrored
       viewport (the height gives back the top's 2px), and the radius still
       shows at all four corners. */
    top: calc(var(--zy-vv-top, 0px) + 2px);
    bottom: auto;
    left: 2px;
    right: 2px;
    height: calc(var(--zy-vvh, 100dvh) - 2px);
    border-radius: 20px;
  }

  /* The frame must round with the veil, or its square corners paint over
     the veil's rounded cut. Modern engines clip iframe content to the radius. */
  .zy-wrap[data-variant="sleek"][data-open="true"] .zy-sleek-frame {
    border-radius: 20px;
  }
}
`,
};

/* variant: classic */
// Icons belong to the variant: a widget that looks nothing like Classic
// brings its own.
  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  };

  registerWidget("classic", {
    // Stylesheet shipped by build-widget.mjs as VARIANT_CSS.classic.
    css: VARIANT_CSS.classic,
    /**
     * @param {{title: string, subtitle: string, color: string, position: string, trigger: string|null}} config
     */
    markup: function (config) {
      // A domain that picked a chat trigger renders THAT launcher instead
      // (the engine mounts it after this markup); "default" keeps ours.
      var launcher = config.trigger
        ? ""
        : ('<button type="button" class="zy-launcher" aria-label="Open chat">' +
          '<span class="zy-open">' +
          ICONS.chat +
          '</span><span class="zy-close">' +
          ICONS.close +
          "</span>" +
          "</button>");
      return (
        '<div class="zy-wrap" data-position="' +
        config.position +
        '" data-variant="classic">' +
        '<div class="zy-panel">' +
        '<div class="zy-header">' +
        '<img class="zy-header-logo" alt="" hidden />' +
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
        "</div>" +
        "</div>" +
        '<div class="zy-note">Powered by Ziyarn</div>' +
        "</div>" +
        launcher +
        "</div>"
      );
    },
  });


/* variant: glow */
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
     * @param {{title: string, subtitle: string, color: string, position: string, trigger: string|null}} config
     */
    markup: function (config) {
      // A domain that picked a chat trigger renders THAT launcher instead
      // (the engine mounts it after this markup); "default" keeps ours.
      var launcher = config.trigger
        ? ""
        : ('<button type="button" class="zy-launcher" aria-label="Open chat">' +
          '<span class="zy-open">' +
          GLOW_ICONS.chat +
          '</span><span class="zy-close">' +
          GLOW_ICONS.close +
          "</span>" +
          "</button>");
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
        launcher +
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


/* variant: sleek */
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


/* trigger stylesheets — keyed by id */
var TRIGGER_CSS = {
  "bubble": `
/* Trigger: bubble — a plain accent circle with the chat icon.
   The base launcher already IS this, so the trigger's job is mostly to
   override a variant's own launcher look back to it: Modern Sleek's 72px
   glass bubble, Glow's halo, etc. These rules load after the variant sheet,
   so they win the ties that matter. */

.zy-wrap[data-trigger="bubble"] .zy-launcher {
  width: 58px;
  height: 58px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--_zy-color);
  color: #fff;
  box-shadow: var(--zy-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.zy-wrap[data-trigger="bubble"] .zy-launcher:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.24);
}

/* Logo icon — swapped in by the engine once /api/chat delivers the domain
   logo. Without a delivered logo the chat icon simply stays. */
.zy-wrap[data-trigger="bubble"] .zy-launcher .zy-trigger-logo {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  padding: 3px;
  background: rgba(255, 255, 255, 0.94);
  object-fit: cover;
}
.zy-trigger-logo[hidden] { display: none; }
.zy-wrap[data-trigger="bubble"] .zy-launcher[data-icon="logo"] .zy-open {
  display: none;
}
`,
  "orb": `
/* Trigger: orb — the glass orb (Strands) as a launcher on any widget.
   Visual contract with Modern Sleek's own launcher: a transparent button the
   canvas fills, with the static chat icon underneath as the WebGL2 fallback.
   The engine mounts the canvas after this markup is in the shadow root. */

.zy-wrap[data-trigger="orb"] .zy-launcher {
  position: relative;
  width: 72px;
  height: 72px;
  padding: 0;
}
.zy-wrap[data-trigger="orb"] .zy-launcher.zy-strands {
  background: transparent;
  box-shadow: none;
}
.zy-wrap[data-trigger="orb"] .zy-launcher.zy-strands:hover {
  box-shadow: none;
}
.zy-wrap[data-trigger="orb"] .zy-launcher.zy-strands .zy-open,
.zy-wrap[data-trigger="orb"] .zy-launcher.zy-strands .zy-close {
  display: none;
}
/* When the chat is open the orb canvas drops away and the button reverts to
   the plain accent circle with the close icon — same behaviour the base
   launcher has when the icon swaps. */
.zy-wrap[data-trigger="orb"][data-open="true"] .zy-launcher canvas {
  opacity: 0;
}
.zy-wrap[data-trigger="orb"][data-open="true"] .zy-launcher.zy-strands {
  background: var(--_zy-color);
  box-shadow: var(--zy-shadow);
}
`,
  "pill": `
/* Trigger: pill — a wider launcher: accent pill with the chat icon and the
   owner's label side by side ("Chat with us" by default). */

.zy-wrap[data-trigger="pill"] .zy-launcher {
  width: auto;
  height: 52px;
  padding: 0 18px 0 15px;
  gap: 9px;
  border-radius: 999px;
}
.zy-wrap[data-trigger="pill"] .zy-launcher svg {
  width: 22px;
  height: 22px;
}
/* The owner's label, next to the icon. When the chat is open the label sits
   beside the close icon — the pill stays a pill at every state. */
.zy-wrap[data-trigger="pill"] .zy-label {
  font-size: 14.5px;
  font-weight: 620;
  letter-spacing: -0.01em;
  white-space: nowrap;
  color: #fff;
}
`,
};

/* chat triggers — launcher styles (see TRIGGERS / helpers.js) */
/**
 * Shared bits for the chat triggers — the icons they render and the
 * customization defaults. The engine includes this file once, then the
 * trigger files that follow.
 *
 * Icons belong to the triggers as a set (a bubble, orb and pill should agree
 * with each other), separate from the variant icons in variants/*.js.
 */
var TRIGGER_ICONS = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

/** Tooltip and pill copy when the owner never wrote one. */
var TRIGGER_TEXT_DEFAULT = "Chat with us";

/**
 * Fills the stored trigger customization with runtime defaults.
 *
 * Stored values come from /api/chat (owner input, validated server-side and
 * already resolved there). When the fetch fails — or an older API answered —
 * this fills the same defaults, so every field is always present. Unknown
 * values fail open: a junk mode keeps the tooltip off rather than on.
 */
function resolveTriggerConfig(value) {
  var stored = (value && typeof value === "object") ? value : {};

  function text(name) {
    var raw = stored[name];
    return typeof raw === "string" && raw.trim()
      ? raw.trim().slice(0, 32)
      : "";
  }

  return {
    // Shown as the label on the pill trigger.
    label: text("label") || TRIGGER_TEXT_DEFAULT,
    // What sits inside the bubble trigger: "chat-icon" or "logo". The logo
    // itself arrives later, when the config request answers.
    iconSource: stored.iconSource === "logo" ? "logo" : "chat-icon",
    // The tooltip chip copy.
    tooltip: text("tooltip") || TRIGGER_TEXT_DEFAULT,
    // "never" | "hover" | "always". Defaulting to off keeps every widget that
    // predates the feature pixel-identical until its owner opts in.
    tooltipVisibility:
      stored.tooltipVisibility === "hover" || stored.tooltipVisibility === "always"
        ? stored.tooltipVisibility
        : "never",
  };
}


/* chat trigger: bubble */
/* Trigger: bubble — the plain chat-icon circle, on any widget. */
registerTrigger("bubble", {
  css: TRIGGER_CSS.bubble,
  /**
   * @param {{label: string}} config
   */
  markup: function (config) {
    void config;
    return (
      '<button type="button" class="zy-launcher zy-trigger-bubble" aria-label="Open chat">' +
      '<span class="zy-open">' +
      TRIGGER_ICONS.chat +
      '<img class="zy-trigger-logo" alt="" hidden /></span>' +
      '<span class="zy-close">' +
      TRIGGER_ICONS.close +
      "</span>" +
      "</button>"
    );
  },
});


/* chat trigger: orb */
/* Trigger: orb — the Strands glass orb launcher on any widget. The canvas is
   mounted by the engine right after this markup lands in the shadow root. */
registerTrigger("orb", {
  css: TRIGGER_CSS.orb,
  /**
   * @param {{label: string}} config
   */
  markup: function (config) {
    void config;
    return (
      '<button type="button" class="zy-launcher zy-trigger-orb" aria-label="Open chat">' +
      '<span class="zy-open">' +
      TRIGGER_ICONS.chat +
      "</span>" +
      '<span class="zy-close">' +
      TRIGGER_ICONS.close +
      "</span>" +
      "</button>"
    );
  },
});


/* chat trigger: pill */
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


/* engine — /api/chat, SSE streaming, delta long-poll, composer */
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
    //   2. Fetches the widget variant from the server config endpoint so that
    //      changing the variant in the dashboard takes effect on live sites
    //      without requiring an embed-snippet update.
    //   3. Creates the Shadow DOM (isolated styles + markup) with that variant
    //   4. Caches references to key DOM elements for fast access
    //   5. Restores visitor ID and conversation from localStorage
    //   6. Wires up event listeners
    //   7. Calls _init() to fetch the full agent config and conversation history
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

      // ---- Fetch the server-authoritative variant, then mount ----
      // The embed snippet no longer needs data-variant. The variant is stored
      // in the database and served by /api/chat so owners can switch widgets
      // from the dashboard without asking customers to update their site.
      //
      // Fail-open: if the request fails for any reason (network, rate-limit,
      // cold start) we fall back to data-variant (backwards-compat with older
      // snippets) then "classic", so no live site is left with a blank widget.
      var self = this;
      var apiBase = this._apiBase;
      var secret = this._secret;
      var VARIANT_FETCH_TIMEOUT_MS = 3000;

      var didMount = false;
      var mountTimeout = setTimeout(function () {
        // Safety net: if the fetch has not resolved within the timeout, mount
        // with the attribute fallback so the widget is never invisible.
        if (!didMount) {
          didMount = true;
          self._mountVariant(resolveVariant(self.getAttribute("data-variant")));
        }
      }, VARIANT_FETCH_TIMEOUT_MS);

      fetch(apiBase + "/api/chat", {
        method: "GET",
        headers: { "x-embed-secret": secret },
      })
        .then(function (response) {
          if (!response.ok) throw new Error("config fetch failed");
          return response.json();
        })
        .then(function (data) {
          clearTimeout(mountTimeout);
          if (!didMount) {
            didMount = true;
            // Stash the whole config (not just widgetVariant): it also names
            // the chat trigger and its customization, resolved at mount.
            self._configData = data || null;
            // widgetVariant from the server takes priority; fall back to the
            // data-variant attribute so older embed snippets keep working.
            var serverVariant =
              data && typeof data.widgetVariant === "string"
                ? data.widgetVariant
                : null;
            var resolvedVariant = resolveVariant(
              serverVariant || self.getAttribute("data-variant")
            );
            self._mountVariant(resolvedVariant);
          }
        })
        .catch(function () {
          clearTimeout(mountTimeout);
          if (!didMount) {
            didMount = true;
            self._mountVariant(resolveVariant(self.getAttribute("data-variant")));
          }
        });
    }

    // -------------------------------------------------------------------------
    // _mountVariant — build the Shadow DOM and wire the widget
    // -------------------------------------------------------------------------
    // Called once the variant is known (either from the server config endpoint
    // or from the data-variant attribute fallback).
    _mountVariant(variant) {
      // ---- Chat trigger and its customization ----
      // The server names the trigger ("default" keeps the launcher this
      // variant ships; here data-trigger is the fallback for old embed
      // snippets). Resolved BEFORE the shadow DOM is built, because the
      // variant's markup must leave its own launcher out when a trigger is
      // picked, and the trigger's stylesheet rides into the same <style>.
      var configData = this._configData || null;
      var triggerName =
        configData && typeof configData.chatTrigger === "string"
          ? configData.chatTrigger
          : this.getAttribute("data-trigger");
      this._trigger = resolveTrigger(triggerName);
      // Customization is fully resolved (label, icon source, tooltip) even
      // when the config request fell back, so every read is plain.
      this._triggerConfig = resolveTriggerConfig(
        configData && configData.chatTriggerConfig
      );

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
      //     <button class="zy-launcher"> — floating chat bubble (variant's or
      //                                    the picked chat trigger's)
      root.innerHTML =
        "<style>" +
        BASE_CSS +
        (variant.css || "") +
        // The trigger's styles come last: they deliberately override the
        // variant's own launcher look on shared properties, and selector ties
        // are won by source order.
        (this._trigger ? this._trigger.css : "") +
        "</style>" +
        variant.markup({
          title: this._title,
          subtitle: this._subtitle,
          color: this._color,
          position: this._position,
          // The trigger id, or null when the variant keeps its own launcher.
          trigger: this._trigger ? this._trigger.id : null,
        });

      // ---- Apply accent color via CSS custom property ----
      var wrap = root.querySelector(".zy-wrap");
      wrap.style.setProperty("--zy-color", this._color);

      // ---- Mount the picked chat trigger ----
      // The variant already emitted no launcher of its own; the trigger's
      // button joins the wrap now. The orb trigger additionally animates
      // (Strands mounts the canvas into the fresh button — see triggers/orb).
      if (this._trigger) {
        wrap.setAttribute("data-trigger", this._trigger.id);
        wrap.insertAdjacentHTML(
          "beforeend",
          this._trigger.markup({ label: this._triggerConfig.label })
        );
        if (this._trigger.id === "orb") {
          this._strands = mountStrands(
            root.querySelector(".zy-launcher"),
            { color: this._color }
          );
        }
        // The bubble trigger may use the owner's logo as its icon, and the
        // config fetch that named the trigger usually already delivers the
        // logo URL — swap immediately rather than waiting for the panel's
        // loadConfig round (which the sleek iframe path never runs; see
        // _mountSleek).
        if (this._triggerConfig.iconSource === "logo") {
          this._setBubbleLogo(
            root.querySelector(".zy-launcher"),
            configData && configData.domain ? configData.domain.logoUrl : null
          );
        }
      }

      // ---- Launcher tooltip ----
      // Rendered for every launcher, whoever owns it, so the feature works on
      // unpicked triggers too. It is the wrap's LAST child, making the
      // launcher its previous sibling — base.css anchors the chip from that
      // pairing, which is why it sits outside the launcher (some launchers
      // clip their contents). Hidden mode mounts nothing at all, so a widget
      // whose owner never touched tooltips renders what it always rendered.
      if (this._triggerConfig.tooltipVisibility !== "never") {
        wrap.setAttribute("data-tip", this._triggerConfig.tooltipVisibility);
        wrap.insertAdjacentHTML(
          "beforeend",
          '<span class="zy-tip" aria-hidden="true"></span>'
        );
        // Owner text goes in via textContent — never markup.
        root.querySelector(".zy-tip").textContent =
          this._triggerConfig.tooltip;
      }

      // ---- Cache DOM references for fast access ----
      // Avoids repeated querySelector calls during streaming/interaction.
      this._root = root;
      this._wrap = wrap;
      this._variant = variant;

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

      // ---- Bootstrap: fetch full agent config + load conversation history ----
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
          if (data) self._configData = data;
          if (data && data.agent) {
            if (data.agent.name) self._titleEl.textContent = data.agent.name;
            if (data.agent.description)
              self._subEl.textContent = data.agent.description;
          }
          if (data && data.placeholders) {
            self._setPlaceholders(data.placeholders);
          }
          self._products = data && Array.isArray(data.products) ? data.products : [];
          var logoUrl = data && data.domain ? data.domain.logoUrl : null;
          if (logoUrl) {
            self._setHeaderLogo(logoUrl);
          }
          // The bubble trigger asked for the logo icon: promote it now that
          // the config answered, in case the mount-time fetch had none. A
          // domain without a logo simply keeps the chat icon.
          if (self._triggerConfig && self._triggerConfig.iconSource === "logo") {
            self._setBubbleLogo(self._launcher, logoUrl);
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

      // The launcher is usually the Strands glass orb — the widget's only
      // always-visible pixel, so it carries the domain's accent colour. But a
      // domain that picked a chat trigger swapped in its own button (mounted
      // before this point), so Strands only animates when the launcher is
      // actually the orb — the untouched default, or the orb trigger itself.
      // mountStrands returns null on browsers without WebGL2 and the static
      // chat icon underneath stays as the fallback.
      if (!this._trigger || this._trigger.id === "orb") {
        this._strands = mountStrands(this._sleekLauncher, {
          color: this._color,
        });
      }

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
    // _setBubbleLogo — bubble trigger with the owner's logo as the icon.
    // -------------------------------------------------------------------------
    // Swap the chat glyph for the uploaded logo once /api/chat delivers it.
    // Without a logo (or on any launcher that is not the bubble trigger) this
    // is a no-op: the chat icon simply stays, so a missing image is never a
    // broken launcher.
    _setBubbleLogo(launcher, logoUrl) {
      if (!launcher || typeof logoUrl !== "string") return;
      if (!launcher.classList.contains("zy-trigger-bubble")) return;
      var logo = launcher.querySelector(".zy-trigger-logo");
      if (!logo) return;
      logo.addEventListener("error", function () {
        launcher.removeAttribute("data-icon");
        logo.hidden = true;
      });
      logo.src = logoUrl;
      logo.hidden = false;
      launcher.setAttribute("data-icon", "logo");
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
      // The Strands launcher owns a requestAnimationFrame loop and a WebGL
      // context; destroying it here keeps a removed widget from animating a
      // detached canvas in the background.
      if (this._strands) {
        this._strands.destroy();
        this._strands = null;
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
        node.innerHTML = renderMd(
          text,
          this._configData && this._configData.locations
        );
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
                typing.innerHTML = renderMd(
                  self._reply,
                  self._configData && self._configData.locations
                );
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
          node.innerHTML = renderMd(
            self._reply,
            self._configData && self._configData.locations
          );
          self._scrollToBottom();
        });
        return;
      }
      typingNode.innerHTML = renderMd(
        this._reply,
        this._configData && this._configData.locations
      );
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
      var productUrl =
        typeof product.productUrl === "string" ? product.productUrl.trim() : "";
      if (productUrl.length > 0 && productUrl.length <= 2000 && /^https?:\/\//i.test(productUrl)) {
        var pageUrl = null;
        try {
          pageUrl = new URL(productUrl);
        } catch (_) {
          pageUrl = null;
        }
        var pathSegments = pageUrl
          ? pageUrl.pathname.toLowerCase().split("/")
          : [];
        if (
          pageUrl &&
          (pageUrl.protocol === "http:" || pageUrl.protocol === "https:") &&
          !pageUrl.username &&
          !pageUrl.password &&
          !(pathSegments[1] === "api" && pathSegments[2] === "storage")
        ) {
          var productLink = document.createElement("a");
          productLink.className = "zy-product-link";
          productLink.href = pageUrl.toString();
          productLink.target = "_blank";
          productLink.rel = "noopener noreferrer";
          productLink.textContent = "View product";
          details.appendChild(productLink);
        }
      }
      card.appendChild(details);
      this._messages.appendChild(card);
      this._scrollToBottom();
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
