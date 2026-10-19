import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { API_ROUTES, APP_ROUTES } from "@/constants/routes";

/**
 * Keeps the route constants honest against the filesystem.
 *
 * A constant naming a deleted page, or a new handler with no constant, is
 * invisible to the type checker — both are just strings. This walks `app/` and
 * checks both directions: every file has a name, and every name has a file.
 *
 * It reads the directory tree rather than `.next/types/routes.d.ts` so it does
 * not need a build first.
 */

const APP_DIR = fileURLToPath(new URL("../app", import.meta.url));
const PARAMETER_CONTAINER = "[^/]+";
const CATCH_ALL = "(?:/.+)?";

/** Stands in for a caller-supplied path segment when calling a builder. */
const PROBE = "__probe__";

type RouteFile = {
  /** As written on disk: `/api/workspace/[workspaceId]`. */
  source: string;
  /** Matches every URL this file serves. */
  matches: RegExp;
  /** The prefix a `[...param]` hang off, for declaring children of a catch-all. */
  catchAllBase: string | null;
};

type Entry = {
  /** Dotted key path in the constants file: `workspace.memberById`. */
  name: string;
  path: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `(marketing)` folders organise files without appearing in the URL. */
function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

function toRouteFile(file: string): RouteFile | null {
  const relativePath = relative(APP_DIR, file).split(sep).join("/");
  const isPage = relativePath.endsWith("page.tsx");
  const isHandler = relativePath.endsWith("route.ts");
  if (!isPage && !isHandler) return null;

  const segments = relativePath
    .replace(/(?:^|\/)(?:page\.tsx|route\.ts)$/, "")
    .split("/")
    .filter((segment) => segment !== "" && !isRouteGroup(segment));

  const source = `/${segments.join("/")}`;
  const parts: string[] = [];
  let catchAllBase: string | null = null;

  for (const segment of segments) {
    const isCatchAllSegment =
      /^\[\[\.\.\..+\]\]$/.test(segment) || /^\[\.\.\..+\]$/.test(segment);
    const isDynamicSegment = /^\[.+\]$/.test(segment);

    if (isCatchAllSegment) {
      // Everything accumulated so far is the mount this catch-all hangs off,
      // e.g. `/api/auth` for `[...all]`.
      catchAllBase = parts.join("") || "/";
      // Both `[...slug]` and `[[...slug]]` serve every depth beneath them, and
      // `[[...slug]]` additionally serves the bare parent URL, so the
      // separator is optional here.
      parts.push(CATCH_ALL);
      continue;
    }
    if (isDynamicSegment) {
      parts.push(`/${PARAMETER_CONTAINER}`);
      continue;
    }
    parts.push(`/${escapeRegExp(segment)}`);
  }

  const pattern = parts.join("");
  return {
    source,
    matches: new RegExp(`^${pattern === "" ? "/" : pattern}$`),
    catchAllBase,
  };
}

/**
 * Every path the constants declare, named. Builders are called with a probe
 * per declared argument, so `workspace.memberById` yields
 * `/api/workspace/__probe__/members/__probe__` and is checked like any other.
 */
function flattenPaths(
  node: unknown,
  scope: string[] = [],
  found: Entry[] = [],
): Entry[] {
  if (typeof node === "string") {
    found.push({ name: scope.join("."), path: node });
    return found;
  }
  if (typeof node === "function") {
    const builder = node as (...args: string[]) => string;
    const probeArguments = Array.from({ length: builder.length }, () => PROBE);
    found.push({ name: scope.join("."), path: builder(...probeArguments) });
    return found;
  }
  if (node !== null && typeof node === "object") {
    for (const [key, child] of Object.entries(node)) {
      flattenPaths(child, [...scope, key], found);
    }
  }
  return found;
}

function servesPath(routeFile: RouteFile, path: string): boolean {
  if (routeFile.matches.test(path)) return true;
  // A catch-all declares its own mount as well as everything beneath it, which
  // is how `auth.root` and `auth.signInEmail` both belong to `[...all]`.
  return (
    routeFile.catchAllBase !== null &&
    (path === routeFile.catchAllBase ||
      path.startsWith(`${routeFile.catchAllBase}/`))
  );
}

function listRouteFiles(
  predicate: (routeFile: RouteFile) => boolean,
): RouteFile[] {
  return walk(APP_DIR)
    .map(toRouteFile)
    .filter((routeFile): routeFile is RouteFile => routeFile !== null)
    .filter(predicate);
}

const pages = listRouteFiles(
  (routeFile) => !routeFile.source.startsWith("/api"),
);
const handlers = listRouteFiles((routeFile) =>
  routeFile.source.startsWith("/api"),
);

const pageEntries = Object.entries(APP_ROUTES).map(([name, path]) => ({
  name,
  path,
}));
const handlerEntries = flattenPaths(API_ROUTES);

function reportMissingRoutes(
  entries: Entry[],
  routeFiles: RouteFile[],
): string[] {
  return entries
    .filter(
      (entry) =>
        !routeFiles.some((routeFile) => servesPath(routeFile, entry.path)),
    )
    .map((entry) => `${entry.name} -> ${entry.path}`);
}

function reportMissingNames(
  routeFiles: RouteFile[],
  entries: Entry[],
): string[] {
  return routeFiles
    .filter(
      (routeFile) =>
        !entries.some((entry) => servesPath(routeFile, entry.path)),
    )
    .map((routeFile) => routeFile.source);
}

describe("route constants", () => {
  it("finds the route files at all, so a broken walk cannot pass silently", () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(handlers.length).toBeGreaterThan(40);
  });

  it("names every page", () => {
    expect(reportMissingNames(pages, pageEntries)).toEqual([]);
  });

  it("names every handler", () => {
    expect(reportMissingNames(handlers, handlerEntries)).toEqual([]);
  });

  it("keeps every page constant pointing at a real page", () => {
    expect(reportMissingRoutes(pageEntries, pages)).toEqual([]);
  });

  it("keeps every handler constant pointing at a real handler", () => {
    expect(reportMissingRoutes(handlerEntries, handlers)).toEqual([]);
  });
});
