import { nextJsConfig } from "@repo/eslint-config/next-js";
import { noBareRoute } from "@repo/eslint-config/no-bare-route";

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
  noBareRoute({
    prefixes: [
      "/dashboard",
      "/api",
      "/portal",
      "/sign-in",
      "/sign-up",
      "/docs",
      "/pricing",
      "/features",
      "/onboarding",
      "/accept-invite",
      "/unsubscribe",
    ],
    ignores: [
      // Only re-exports @repo/routes; the package has its own lint config.
      "constants/routes/**",
      // The matcher must stay a literal. Next reads config.matcher with a static
      // AST pass (extractExportedConstValue), not by running the module, so a
      // constant there fails the build with `Unsupported node type
      // "Identifier"`.
      "proxy.ts",
      // Classifies route files by mount, the same way the crawler in
      // services/api does. Nothing here links or fetches; the file exists to
      // compare the app tree against the constants, so it has to be able to say
      // the mount out loud.
      "lib/routes.test.ts",
    ],
  }),
];
