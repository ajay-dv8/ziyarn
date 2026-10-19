#!/usr/bin/env node
/**
 * Assembles the Ziyarn widget into a single self-contained file.
 *
 * Why a build at all: the widget renders inside a Shadow DOM, so host-page CSS
 * cannot reach it — every style must be inlined into the shadow root. A separate
 * <link> or fetch would mean two sequential requests, which doubles the failure
 * surface on the flaky mobile networks this product targets, and a CSS failure
 * leaves the customer's widget permanently unstyled. So the styles are authored
 * as real .css files and inlined here.
 *
 * The output public/widget.js is COMMITTED, so a deploy can never ship a widget
 * whose sources were never built. Run this after editing anything in widget/.
 *
 *   node scripts/build-widget.mjs          build
 *   node scripts/build-widget.mjs --check  fail if the committed output is stale
 *
 * No dependencies. Pure string concatenation in a fixed order.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { build as bundle } from "esbuild";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const srcDir = join(appRoot, "widget");
const outFile = join(appRoot, "public", "widget.js");

/**
 * Variants, in load order. The first is the fallback.
 *
 * To add one: drop its .css and .js into widget/variants/ and add its id here
 * (plus a row in services/api/src/domains/widget-variants.ts). Both files are
 * required — a half-added variant fails the build loudly rather than shipping.
 */
const VARIANTS = ["classic", "glow"];

const BANNER = (name) => `/* ${name} */`;

function read(...parts) {
  const file = join(srcDir, ...parts);
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Error(
      `missing widget source: widget/${parts.join("/")}\n` +
        "If this variant is new, add its id to VARIANTS in this script AND a " +
        "row in services/api/src/domains/widget-variants.ts.",
    );
  }
}

/**
 * Fails the build if a variant's markup does not balance.
 *
 * The markup is a tree of concatenated strings, so an edit that removes a
 * wrapper has to remove the matching closing tag by eye. Get that wrong and the
 * launcher ends up inside the closed panel: the widget still "renders", but at
 * zero size, and it is invisible on every customer site — with no error
 * anywhere to point at. Counting the tags is the cheapest guard that catches it.
 */
function assertBalancedMarkup(id, source) {
  const tags = ["div", "span", "button", "ul", "li"];
  for (const tag of tags) {
    const opens = (source.match(new RegExp(`<${tag}\\b`, "g")) || []).length;
    const closes = (source.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (opens !== closes) {
      throw new Error(
        `widget/variants/${id}.js: <${tag}> opens ${opens} time(s) but closes ` +
          `${closes}. The markup is unbalanced — check that every element you ` +
          "removed also had its closing tag removed.",
      );
    }
  }
}

/** Wraps CSS in a template literal, escaping backticks and ${ so it cannot break out. */
function asCssLiteral(css) {
  return "`\n" + css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

/**
 * Bundles @repo/widget-core into a single IIFE and returns its source.
 *
 * The core is the widget's conversation logic — transport, streaming, storage —
 * shared with the React package and any future native client. It is bundled
 * rather than imported so the shipped file stays self-contained: one request,
 * no runtime dependencies, no module loader in the customer's page.
 *
 * The text is spliced into the output as code (esbuild's `globalName` already
 * emits `var ZiyarnCore = (() => { … })();`), which is why it must NOT be
 * wrapped in quotes the way the CSS literals are.
 */
async function coreLiteral() {
  // Resolved by package name so the build does not hard-code the repo layout.
  const entry = createRequire(import.meta.url).resolve(
    "@repo/widget-core/src/index.ts",
  );
  const result = await bundle({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName: "ZiyarnCore",
    target: "es2020",
    platform: "browser",
    write: false,
    minify: true,
    legalComments: "none",
  });
  return result.outputFiles[0].text.trim();
}

async function build() {
  const baseCss = read("base.css");

  const cssMap = VARIANTS.map((id) => {
    const css = read("variants", `${id}.css`);
    return `  ${JSON.stringify(id)}: ${asCssLiteral(css)},`;
  }).join("\n");

  // Checked before anything is assembled, so a bad edit fails with a message
  // about the source rather than a broken bundle.
  for (const id of VARIANTS) {
    assertBalancedMarkup(id, read("variants", `${id}.js`));
  }

  const parts = [
    read("preamble.js"),
    "",
    BANNER("core — @repo/widget-core, bundled (transport, stream, session, store)"),
    await coreLiteral(),
    "",
    BANNER("helpers — dom utilities, markdown, variant registry"),
    read("helpers.js"),
    "",
    BANNER("thinking orb — canvas renderer + timeline engine (Glow)"),
    read("orb.js"),
    "",
    BANNER("base styles — panel, header, messages, composer, chips"),
    // base.css is the shared shell and the reference look. Variant CSS is
    // APPENDED after it, so a variant only has to declare what it changes.
    // Each variant also scopes its own rules under .zy-wrap[data-variant="<id>"],
    // which its markup sets, so two variants could never bleed into each other
    // regardless of load order.
    `var BASE_CSS = ${asCssLiteral(baseCss)};`,
    "",
    BANNER("variant stylesheets — keyed by id"),
    `var VARIANT_CSS = {\n${cssMap}\n};`,
    "",
    ...VARIANTS.flatMap((id) => [
      BANNER(`variant: ${id}`),
      read("variants", `${id}.js`),
      "",
    ]),
    BANNER("engine — /api/chat, SSE streaming, delta long-poll, composer"),
    read("engine.js"),
    "",
    read("epilogue.js"),
  ];

  return parts.join("\n") + "\n";
}

async function main() {
  const output = await build();
  const existing = (() => {
    try {
      return readFileSync(outFile, "utf8");
    } catch {
      return null;
    }
  })();

  if (process.argv.includes("--check")) {
    if (existing !== output) {
      console.error(
        "public/widget.js is STALE — run: pnpm --filter web build:widget",
      );
      process.exit(1);
    }
    console.log("public/widget.js is up to date");
  } else {
    writeFileSync(outFile, output);
    const kb = (Buffer.byteLength(output) / 1024).toFixed(1);
    console.log(`built public/widget.js — ${kb} KB (${output.split("\n").length} lines)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});