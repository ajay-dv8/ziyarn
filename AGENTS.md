# Ziyarn — Developer Notes

AI agent platform (helpdesk + sales). Monorepo: pnpm + turbo.
See `plan/rebuild_divesai.md` for the roadmap and `plan/*.md` for architecture.

## Commands

- Install: `pnpm install`
- Dev server (apps/web): see "Dev server" below — do NOT use `pnpm dev` in background.
- Typecheck: `pnpm --filter <pkg> check-types`
- Lint: `pnpm --filter <pkg> lint`
- DB migrate/push: from `packages/database`, `pnpm exec drizzle-kit generate|migrate|push`.
  If drizzle-kit hangs on introspection, apply the generated SQL manually (see DB notes).

## Git

- NEVER commit, amend, or push unless the user explicitly asks. Stage changes and report; the user decides when to commit.

## Dev server / build (critical)

- ALWAYS run builds, `next dev`, and `next start` resource-limited to 4 CPUs
  and 5 GB RAM (this machine is RAM-constrained):

  ```
  NODE_OPTIONS="--max-old-space-size=5120" taskset -c 0-3 pnpm dev --filter=web
  ```

  Same pattern for `pnpm --filter web build` and `next start` (when the pnpm
  wrapper hangs in the background, drop it and use the direct binary:
  `node ./node_modules/next/dist/bin/next <dev|start> --port <port>`).

- The dev server reliably DEADLOCKS (accepts TCP, never responds, idle CPU) when
  launched with plain `setsid node ... > file &`. It must be launched through a
  PTY or the requests hang indefinitely:

  ```
  cd apps/web && rm -rf .next
  NODE_OPTIONS="--max-old-space-size=5120" nohup setsid /usr/bin/script -qec "taskset -c 0-3 node ./node_modules/next/dist/bin/next dev --port 3000" /tmp/opencode/fg.log </dev/null >/dev/null 2>&1 & disown
  ```

- Never `pkill -f "next/dist/bin/next"` from a shell whose own command line
  contains that string (it kills the shell). Use the bracket trick:
  `pkill -f "[n]ext/dist/bin/next"`.
- First dynamic request compiles; static files (favicon) answer instantly.
  Real errors only appear in the PTY log (stdout is block-buffered to files).

## Network quirks on this machine

- The mobile-hotspot network is flaky: npm registry AND Neon drop packets
  intermittently (ETIMEDOUT, "fetch failed"). Workarounds:
  - `.npmrc` has high fetch retries/timeouts; retry installs.
  - Neon: `setDefaultResultOrder("ipv4first")` + a transient-error retry
    wrapper are baked into `packages/database/src/index.ts`. The wrapper MUST
    expose `.query()` for drizzle (see that file — do not remove).
  - Stray `/home/ajay/package.json` + `/home/ajay/pnpm-lock.yaml` (junk from an
    unrelated tool, harper.js) make Turbopack misdetect `/home/ajay` as the
    workspace root and hang on every request. If the dev server spins at ~100%
    CPU, check for them and delete them.
- `sql.unsafe()` in @neondatabase/serverless does NOT execute queries (returns
  a statement object). Use `sql.query(sql, params)` for raw SQL.

## Package conventions

- Shared packages export RAW TS via `exports` in package.json
  (e.g. `".": "./src/index.ts"`). NEVER use relative `./x.js` imports inside
  shared packages — Turbopack can't resolve `.js` → `.ts` there. Use the
  package's own exports map (self-reference), e.g.
  `import * as schema from "@repo/database/schema"`.
- All service boundaries use zod validation; server actions/API routes must
  verify ownership. No module-level mutable state.
- **NEVER use single-character variable names.** Use descriptive names instead.
  Examples: `q` → `question`, `p` → `product`/`catalogItem`, `m` → `message`,
  `a` → `answerEntry`, `i` → `dayIndex`/`index`, `s` → `since`. The only
  exception is `for (const x of ...)` loops where the variable is immediately
  used and its meaning is obvious from context. This applies to all new code
  and should be enforced during code review.

## Env vars (apps/web/.env)

DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL,
GOOGLE_CLIENT_ID/SECRET, LINKEDIN_CLIENT_ID/SECRET (OAuth creds empty — social
buttons only render when IDs are set). turbo.json globalEnv lists all of these.
