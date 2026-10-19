import { nextJsConfig } from "@repo/eslint-config/next-js";
import { noBareRoute } from "@repo/eslint-config/no-bare-route";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  noBareRoute({
    // `/setup` and `/sign-in` sit outside /admin on purpose: neither can require
    // an admin session to reach.
    prefixes: ["/admin", "/api", "/sign-in", "/sign-up", "/setup"],
    // constants/routes.ts is where the paths are defined, so it is the one file
    // allowed to write them.
    ignores: ["constants/routes.ts"],
  }),
];
