#!/usr/bin/env node
/**
 * End-to-end check for the chat widget, in a real browser.
 *
 * The widget is a shadow-DOM web component that talks to /api/chat over SSE and
 * keeps state in localStorage. None of that is reachable from a unit test, and
 * the failure mode is silent: a markup slip once left the launcher nested
 * inside a display:none panel — the widget "worked", threw nothing, and was
 * invisible on every customer site. So this drives a real Chrome against a fake
 * API and asserts what a visitor would actually see.
 *
 *   node scripts/widget-e2e.mjs              run the checks
 *   node scripts/widget-e2e.mjs --keep       leave the page open for debugging
 *
 * Needs `google-chrome` on PATH, or `CHROME_BIN` pointing at a Chrome binary.
 * Exits non-zero on the first failed check.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const widgetFile = join(appRoot, "public", "widget.js");

const PORT = Number(process.env.WIDGET_E2E_PORT ?? 3210);
const CDP_PORT = Number(process.env.WIDGET_E2E_CDP_PORT ?? 9333);
const keepOpen = process.argv.includes("--keep");

// --- Assertions -----------------------------------------------------------
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "  ok  " : " FAIL ";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

// --- Fake /api/chat --------------------------------------------------------
/**
 * The three endpoints the widget uses, plus the two SSE shapes. Answers are
 * deliberately distinctive strings so an assertion can tell "the widget rendered
 * what the server sent" from "the widget rendered some default".
 */
/** One owner reply per conversation, not per page: an earlier tab's reconnect
 *  loop must not consume the reply the current run is waiting for. */
const deliveredOwnerReplies = new Set();

function sse(res, events) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  for (const event of events) res.write(`data: ${JSON.stringify(event)}\n\n`);
  res.end();
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // The widget script itself.
  if (path === "/widget.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    res.end(readFileSync(widgetFile, "utf8"));
    return;
  }

  // A page with the widget on it, pointed at this fake API.
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>widget e2e</title>
<style>body{height:1400px;margin:0}</style></head>
<body>
<script defer src="/widget.js"></script>
<zy-widget data-slug="${url.searchParams.get("slug") ?? "e2e-domain"}"
            data-secret="e2e-secret"
            data-api="http://localhost:${PORT}"
            data-variant="${url.searchParams.get("variant") ?? "classic"}"></zy-widget>
</body></html>`);
    return;
  }

  if (path !== "/api/chat") {
    res.writeHead(404).end();
    return;
  }

  if (!req.headers["x-embed-secret"]) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { code: "MISSING_SECRET", message: "Missing embed secret" } }));
    return;
  }

  const conversationId = url.searchParams.get("conversationId");

  // Owner-reply delta stream.
  if (url.searchParams.get("stream") === "1" && conversationId) {
    if (!deliveredOwnerReplies.has(conversationId)) {
      deliveredOwnerReplies.add(conversationId);
      sse(res, [
        {
          type: "message",
          message: {
            sender: "owner",
            content: "OWNER_REPLY_FROM_SERVER",
            createdAt: new Date().toISOString(),
          },
        },
        { type: "done", serverTime: new Date().toISOString() },
      ]);
      return;
    }
    sse(res, [{ type: "done", serverTime: new Date().toISOString() }]);
    return;
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const conversationId = `e2e-conv-${body.visitorId ?? "anonymous"}`;
    sse(res, [
      { type: "tool", name: "sell_product", args: { product: "E2E Jersey" } },
      { type: "text", delta: "STREAMED_" },
      { type: "text", delta: "REPLY_" },
      { type: "text", delta: "FROM_SERVER" },
      // Markdown arrives token by token, exactly like the real agent. The
      // checks below prove the shadow variants render it instead of showing
      // literal ** and - markers.
      {
        type: "text",
        delta:
          "\n\n**Top picks:**\n- **Alpha** jersey\n- Beta jersey\n\n1. First step\n2. Second step",
      },
      { type: "done", conversationId, serverTime: new Date().toISOString() },
    ]);
    return;
  }

  // GET with a conversation id is history; without one it is the agent config.
  if (conversationId) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        conversation: { id: conversationId, status: "escalated" },
        messages: [
          { role: "user", content: "HISTORY_USER_MESSAGE" },
          { role: "assistant", content: "HISTORY_AGENT_MESSAGE" },
        ],
      }),
    );
    return;
  }

  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      domain: {
        slug: "e2e",
        logoUrl:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Crect width='30' height='30' fill='%2310b981'/%3E%3C/svg%3E",
      },
      agent: { name: "E2E Agent", description: "E2E description from server" },
      placeholders: ["E2E_PLACEHOLDER_PROMPT"],
      businessType: "retail",
      knowledgeSearch: true,
      widgetVariant: "classic",
      products: [{ name: "E2E Jersey", priceCents: 12000, currency: "ghs", imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%2310b981'/%3E%3C/svg%3E" }],
    }),
  );
});

// --- Chrome ----------------------------------------------------------------
const profileDir = mkdtempSync(join(tmpdir(), "widget-e2e-"));
const chromeBinary = process.env.CHROME_BIN ?? "google-chrome";
const chrome = spawn(
  chromeBinary,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1100,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function waitForCdp() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chrome did not expose a debugging port");
}

// --- CDP session -----------------------------------------------------------
async function openPage(url) {
  const target = await (
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, {
      method: "PUT",
    })
  ).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const pageErrors = [];
  const pageLogs = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      pageErrors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    }
    if (message.method === "Runtime.consoleAPICalled") {
      pageLogs.push(
        `[${message.params.type}] ` +
          (message.params.args ?? [])
            .map((arg) => arg.value ?? arg.description ?? "")
            .join(" "),
      );
    }
    if (
      message.method === "Log.entryAdded" &&
      message.params.entry.level === "error"
    ) {
      // The fake page has no favicon; that 404 is the harness, not the widget.
      const text = String(message.params.entry.text ?? "");
      const url = String(message.params.entry.url ?? "");
      if (/favicon/.test(text) || /favicon/.test(url)) return;
      pageErrors.push(`[log] ${text}`);
    }
  });

  const send = (method, params = {}) => {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.navigate", { url });

  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      // Chrome reports a page-thrown error as the bare word "Uncaught"; the
      // description carries the message, so prefer it.
      const thrown =
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "evaluate failed";
      throw new Error(thrown.split("\n")[0]);
    }
    return result.result.value;
  };

  return {
    evaluate,
    errors: pageErrors,
    logs: pageLogs,
    close: async () => {
      try {
        await fetch(
          `http://127.0.0.1:${CDP_PORT}/json/close/${target.id}`,
        );
        socket.close();
      } catch {
        /* the tab is going away anyway */
      }
    },
  };
}

/** Reads values out of the widget's shadow root. `body` is an object literal. */
const shadow = (body) =>
  `(() => {
    const widget = document.querySelector('zy-widget');
    const root = widget && widget.shadowRoot;
    if (!root) return JSON.stringify({ missing: true });
    return JSON.stringify({ ${body} });
  })()`;

/** Runs statements inside the widget's shadow root. `code` is a statement list. */
const shadowRun = (code) =>
  `(() => {
    const widget = document.querySelector('zy-widget');
    const root = widget && widget.shadowRoot;
    if (!root) throw new Error('widget has no shadow root');
    ${code}
    return true;
  })()`;

const rect = (selector) =>
  shadow(`rect: (() => { const el = root.querySelector('${selector}'); if (!el) return null; const r = el.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) }; })()`);

const textOf = (selector) =>
  shadow(`text: (() => { const el = root.querySelector('${selector}'); return el ? el.textContent : null; })()`);

async function runVariant(variant) {
  console.log(`\n── ${variant} widget ─────────────────────────────`);

    // Fresh storage per variant: the visitor id and conversation id are namespaced
  // by slug, so a second variant must not inherit the first one's conversation.
  const page = await openPage(
    `http://localhost:${PORT}/?variant=${variant}&slug=e2e-${variant}`,
  );
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const launcher = JSON.parse(await page.evaluate(rect(".zy-launcher")));
  check(
    `${variant}: launcher is visible`,
    !launcher.missing && launcher.rect && launcher.rect.width > 20 && launcher.rect.height > 20,
    launcher.missing ? "no shadow root" : `${launcher.rect?.width}×${launcher.rect?.height}`,
  );

  // Open the panel.
  await page.evaluate(shadowRun(`root.querySelector('.zy-launcher').click();`));
  await new Promise((resolve) => setTimeout(resolve, 800));

  const panel = JSON.parse(await page.evaluate(rect(".zy-panel")));
  check(
    `${variant}: panel opens`,
    panel.rect && panel.rect.width > 100 && panel.rect.height > 100,
    `${panel.rect?.width}×${panel.rect?.height}`,
  );

  const title = JSON.parse(await page.evaluate(textOf(".zy-header-title"))).text;
  check(
    `${variant}: agent config applied`,
    title === "E2E Agent",
    `title was ${JSON.stringify(title)}`,
  );

  const logo = JSON.parse(
    await page.evaluate(
      shadow(`
        logo: (() => {
          const element = root.querySelector('.zy-header-logo');
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return {
            hidden: element.hidden,
            src: element.getAttribute('src'),
            width: Math.round(box.width),
            height: Math.round(box.height),
          };
        })(),
      `),
    ),
  ).logo;
  check(
    `${variant}: domain logo shown`,
    Boolean(logo) && logo.hidden === false && logo.width > 0 && logo.height > 0,
    logo
      ? `${logo.width}×${logo.height} ${String(logo.src).slice(0, 32)}`
      : "missing",
  );

  const hint = JSON.parse(
    await page.evaluate(
      shadow(`
        hintText: (() => { const el = root.querySelector('.zy-composer-ph'); return el ? el.textContent : null; })(),
        chip: Boolean(root.querySelector('.zy-chip')),
      `),
    ),
  );
  check(`${variant}: no deep-search chip`, hint.chip === false);
  check(
    `${variant}: server placeholder shown`,
    (hint.hintText ?? "").includes("E2E_PLACEHOLDER_PROMPT"),
    hint.hintText ?? "none",
  );

  // Focus hides the hint.
  await page.evaluate(
    shadowRun(`
      const input = root.querySelector('.zy-composer input');
      input.dispatchEvent(new FocusEvent('focus'));
      input.value = 'a visitor is typing';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `),
  );
  await new Promise((resolve) => setTimeout(resolve, 400));
  const typing = JSON.parse(
    await page.evaluate(
      shadow(`
        hidden: root.querySelector('.zy-composer').getAttribute('data-ph-hidden'),
        opacity: getComputedStyle(root.querySelector('.zy-composer-ph')).opacity,
      `),
    ),
  );
  check(
    `${variant}: hint hides while typing`,
    typing.hidden === "true" && typing.opacity === "0",
    `hidden=${typing.hidden} opacity=${typing.opacity}`,
  );

  // Send, and expect the streamed reply to land.
  await page.evaluate(
    shadowRun(`
      const input = root.querySelector('.zy-composer input');
      input.dispatchEvent(new FocusEvent('focus'));
      input.value = 'where is my order';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      root.querySelector('.zy-send').click();
    `),
  );
  await new Promise((resolve) => setTimeout(resolve, 4000));

  const messages = JSON.parse(await page.evaluate(textOf(".zy-messages"))).text ?? "";
  check(
    `${variant}: streamed reply rendered`,
    messages.includes("STREAMED_REPLY_FROM_SERVER"),
    messages.replace(/\s+/g, " ").slice(0, 80),
  );

  // Markdown in the streamed reply: lists become real list elements, bold
  // becomes <strong>, and no literal markers survive in the visible text.
  const markdown = JSON.parse(
    await page.evaluate(
      shadow(`
        markdown: (() => {
          const agent = [...root.querySelectorAll('.zy-msg-agent')].find((node) =>
            node.textContent.includes('STREAMED_REPLY_FROM_SERVER'),
          );
          if (!agent) return null;
          return {
            bullets: agent.querySelectorAll('ul.zy-md-list li').length,
            numbered: agent.querySelectorAll('ol.zy-md-list li').length,
            strong: [...agent.querySelectorAll('strong')].map(
              (node) => node.textContent,
            ),
            literalMarkers:
              agent.textContent.includes('**') ||
              agent.textContent.includes('- Alpha'),
          };
        })()
      `),
    ),
  ).markdown;
  check(
    `${variant}: markdown lists rendered`,
    Boolean(markdown) && markdown.bullets >= 2 && markdown.numbered >= 2,
    JSON.stringify(markdown),
  );
  check(
    `${variant}: markdown emphasis rendered without literal markers`,
    Boolean(markdown) &&
      markdown.strong.includes("Top picks:") &&
      markdown.strong.includes("Alpha") &&
      markdown.literalMarkers === false,
    JSON.stringify(markdown),
  );
  const productCard = JSON.parse(await page.evaluate(shadow(`product: (() => { const card = root.querySelector('.zy-product-card'); const image = root.querySelector('.zy-product-image'); return card ? { text: card.textContent, image: image ? image.getAttribute('src') : null } : null; })()`))).product;
  check(`${variant}: product card with image rendered`, Boolean(productCard) && productCard.text.includes("E2E Jersey") && Boolean(productCard.image), JSON.stringify(productCard));

  // The owner reply arrives on the delta stream for an escalated conversation.
  const ownerReplySeen = await (async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const text = JSON.parse(await page.evaluate(textOf(".zy-messages"))).text ?? "";
      if (text.includes("OWNER_REPLY_FROM_SERVER")) return true;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return false;
  })();
  check(`${variant}: owner reply appended`, ownerReplySeen);

  check(`${variant}: no uncaught errors`, page.errors.length === 0, page.errors[0] ?? "");

  for (const line of page.logs) console.log(`      page: ${line}`);
  for (const line of page.errors) console.log(`      error: ${String(line).split("\n")[0]}`);

  // Close it before the next variant: a left-open tab keeps its delta loop
  // polling and would race the run that follows.
  await page.close();
}

// --- Run -------------------------------------------------------------------
await new Promise((resolve) => server.listen(PORT, resolve));
await waitForCdp();

let failed = 0;
try {
  for (const variant of ["classic", "glow"]) {
    await runVariant(variant);
  }

  // A reload must restore the conversation from localStorage.
  const restored = await openPage(
    `http://localhost:${PORT}/?variant=classic&slug=e2e-classic`,
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const messages = JSON.parse(await restored.evaluate(textOf(".zy-messages"))).text ?? "";
  check(
    "conversation restores after reload",
    messages.includes("HISTORY_USER_MESSAGE") && messages.includes("HISTORY_AGENT_MESSAGE"),
    messages.replace(/\s+/g, " ").slice(0, 80),
  );

  failed = results.filter((result) => !result.ok).length;
} catch (error) {
  // A thrown check is a failure too — report it rather than losing it behind
  // the cleanup.
  check(`harness: ${error.message.split("\n")[0]}`, false);
  failed += 1;
} finally {
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  server.close();
  if (keepOpen) {
    console.log("left Chrome open for debugging — ctrl-c when done");
  } else {
    chrome.kill();
    // Chrome writes to the profile as it exits, so give it a moment before
    // removing the directory — and never let cleanup mask a real failure.
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      /* a leftover temp profile is not worth failing over */
    }
  }
  process.exit(failed === 0 ? 0 : 1);
}
