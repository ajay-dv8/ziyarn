import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      ".source/**",
      // Widget sources are FRAGMENTS of one generated IIFE, not standalone
      // modules: each uses `var` declarations and globals defined in a sibling
      // file, so none of them parses or resolves on its own. The assembled
      // public/widget.js is checked by `pnpm check-widget` + `node --check`.
      "widget/**",
      // Generated from widget/ by scripts/build-widget.mjs. Never hand-edit;
      // linting the output would only re-report the fragments above.
      "public/widget.js",
    ],
  },
  ...nextJsConfig,
  {
    // Node build scripts live alongside the app, so they need Node globals.
    // Spelled out explicitly rather than pulled from the `globals` package to
    // avoid adding a dependency for four names.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        URL: "readonly",
      },
    },
  },
];
