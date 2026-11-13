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
  // bare https:// links, email/phone autolinks, tel:/mailto: links, and
  // em/en-dash spacing.
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
  function renderMdInline(source, locationMap, allowAutolinks) {
    if (allowAutolinks === undefined) allowAutolinks = true;
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
            renderMdInline(
              source.slice(index + 2, strongClose),
              locationMap,
              allowAutolinks
            ) +
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
            renderMdInline(
              source.slice(index + 2, delClose),
              locationMap,
              allowAutolinks
            ) +
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
            renderMdInline(
              source.slice(index + 1, emClose),
              locationMap,
              allowAutolinks
            ) +
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
            renderMdInline(
              source.slice(index + 1, underscoreClose),
              locationMap,
              allowAutolinks
            ) +
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
            '"' +
            mdLinkTarget(link[2]) +
            ">" +
            renderMdInline(link[1], locationMap, false) +
            "</a>";
          index += link[0].length;
          continue;
        }
      }

      // Bare URLs, only at a word boundary so "xhttps://…" stays text.
      if (
        allowAutolinks &&
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
              '"' +
              mdLinkTarget(url) +
              ">" +
              esc(url) +
              "</a>";
            index += url.length;
            continue;
          }
        }
      }

      if (allowAutolinks) {
        var contact = mdContactAt(source, index);
        if (contact) {
          flushPlain();
          html +=
            '<a href="' +
            esc(contact.href) +
            '"' +
            mdLinkTarget(contact.href) +
            ">" +
            esc(contact.text) +
            "</a>";
          index += contact.text.length;
          continue;
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

  var MD_EMAIL_PATTERN =
    /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+/;
  var MD_PHONE_PATTERN = /^\(?\+?\(?\d[\d() .-]{5,}\d/;

  function isMdSafeUrl(url) {
    return (
      /^(?:https?:\/\/|mailto:)/i.test(url) ||
      /^tel:\+?\d[\d().\s-]*$/i.test(url)
    );
  }

  function mdIsContactUrl(url) {
    return /^(?:mailto:|tel:)/i.test(url);
  }

  function mdLinkTarget(url) {
    return mdIsContactUrl(url)
      ? ""
      : ' target="_blank" rel="noopener noreferrer"';
  }

  function mdEmailAt(source, index) {
    var previous = source[index - 1] || "";
    if (previous && /[A-Za-z0-9._%+-]/.test(previous)) return null;

    var match = MD_EMAIL_PATTERN.exec(source.slice(index));
    if (!match) return null;
    var text = match[0];
    if (text.length > 254) return null;

    var next = source[index + text.length] || "";
    if (next && /[A-Za-z0-9_-]/.test(next)) return null;
    return { text: text, href: "mailto:" + text };
  }

  function mdHasPhoneContext(source, index) {
    var before = source.slice(Math.max(0, index - 32), index);
    return /\b(?:call|phone|tel|telephone|mobile|cell|whatsapp|contact|dial|reach)\b[^\n]{0,24}$/i.test(
      before
    );
  }

  function mdPhoneAt(source, index) {
    var previous = source[index - 1] || "";
    if (/[0-9]/.test(previous)) return null;

    var match = MD_PHONE_PATTERN.exec(source.slice(index));
    if (!match) return null;

    var text = match[0];
    if (text.length > 40) return null;
    var digits = text.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return null;

    var next = source[index + text.length] || "";
    if (/[A-Za-z0-9_@#/$%-]/.test(previous)) return null;
    if (/[A-Za-z0-9_%-]/.test(next)) return null;

    var hasPlus = /^\(?\+/.test(text);
    if (
      /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}\s+\d{1,2}\s+\d{1,2}|\d{1,2}\s+\d{1,2}\s+\d{4})$/.test(
        text
      ) ||
      /^\d{4}(?:\s*[-/.]\s*|\s+)\d{4}$/.test(text) ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(text) ||
      /^\d{1,3}(?:[ .-]\d{3})+$/.test(text) ||
      /^\d+\.\d+$/.test(text)
    ) {
      return null;
    }
    if (countMdCharacter(text, "(") !== countMdCharacter(text, ")")) {
      return null;
    }

    if (!hasPlus && !/[()]/.test(text)) {
      var groups = text.split(/[ .-]+/);
      if (!groups.some(function (group) { return group.length >= 3; })) {
        return null;
      }
    }

    var hasFormatting = /[() .-]/.test(text);
    if (!hasPlus && !hasFormatting && !mdHasPhoneContext(source, index)) {
      return null;
    }

    return { text: text, href: "tel:" + (hasPlus ? "+" : "") + digits };
  }

  function mdContactAt(source, index) {
    var character = source[index] || "";
    if (/[A-Za-z0-9._%+-]/.test(character)) {
      var email = mdEmailAt(source, index);
      if (email) return email;
    }
    if (/[+(\d]/.test(character)) {
      return mdPhoneAt(source, index);
    }
    return null;
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