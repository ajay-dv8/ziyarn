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
  function renderMd(text) {
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
        html += '<p class="zy-md-h">' + renderMdInline(heading[1]) + "</p>";
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
          bullets += "<li>" + renderMdInline(bullet[1].trim()) + "</li>";
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
          numbers += "<li>" + renderMdInline(numbered[1].trim()) + "</li>";
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
          renderMdInline(quotedLines.join("\n")) +
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
      html += "<p>" + renderMdInline(paragraph.join("\n")) + "</p>";
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
  function renderMdInline(source) {
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
            "<strong>" + renderMdInline(source.slice(index + 2, strongClose)) + "</strong>";
          index = strongClose + 2;
          continue;
        }
      }

      if (source.slice(index, index + 2) === "~~") {
        var delClose = source.indexOf("~~", index + 2);
        if (delClose !== -1 && delClose > index + 2) {
          flushPlain();
          html += "<del>" + renderMdInline(source.slice(index + 2, delClose)) + "</del>";
          index = delClose + 2;
          continue;
        }
      }

      if (character === "*") {
        var emClose = source.indexOf("*", index + 1);
        if (emClose !== -1 && emClose > index + 1) {
          flushPlain();
          html += "<em>" + renderMdInline(source.slice(index + 1, emClose)) + "</em>";
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
            "<em>" + renderMdInline(source.slice(index + 1, underscoreClose)) + "</em>";
          index = underscoreClose + 1;
          continue;
        }
      }

      if (character === "[") {
        var link = source.slice(index).match(/^\[([^\]]*)\]\(([^)\s]+)\)/);
        if (link && isMdSafeUrl(link[2])) {
          flushPlain();
          html +=
            '<a href="' +
            esc(link[2]) +
            '" target="_blank" rel="noopener noreferrer">' +
            renderMdInline(link[1]) +
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