# Ziyarn

Ziyarn is an AI agent platform for helpdesk and sales. A business creates a
domain, teaches an agent from its own knowledge, embeds the widget on its site,
and lets the agent answer questions, capture leads, sell products, book
appointments, and hand off to a human when needed.

## Monorepo layout

| Path | What it is |
|---|---|
| `apps/web` | Customer app: marketing site, dashboard, chat API, widget, portal, docs (Fumadocs) |
| `apps/admin` | Read-mostly operator panel, deployed separately on port 3001 |
| `services/api` | Domain services: auth-adjacent flows, domains, agents, knowledge, chat, leads, products, bookings, campaigns, billing, portal |
| `services/ai` | Provider abstraction for Gemini, OpenRouter, and fallbacks |
| `packages/database` | Drizzle schema, migrations, and the retrying Neon client |
| `packages/routes` | Route constants shared by the app and the widget |
| `packages/ui` | Shared UI primitives |
| `packages/widget-core` | Transport, session, and streaming code used by the widget |
| `packages/money` | Money parsing/formatting helpers |
| `packages/state` | Small shared state utilities |
| `packages/eslint-config`, `packages/typescript-config` | Shared tooling |

Next.js App Router, React, TypeScript, Tailwind, Drizzle ORM, Neon Postgres,
Better Auth, and a dependency-free vanilla JS widget rendered in a Shadow DOM.

## Requirements

- Node.js 24 (the repo also declares `>=18`, but CI uses 24)
- pnpm 11 (`corepack enable` or `npm i -g pnpm@11`)
- A Postgres database (Neon free tier is enough)
- At least one AI provider key for chat

## Quickstart

```sh
pnpm install

cp apps/web/.env.example apps/web/.env
# Fill in DATABASE_URL, BETTER_AUTH_SECRET, and one AI provider key.

# Apply the schema (see "Database" below), then:
pnpm --filter web dev
```

The app runs at http://localhost:3000. The widget browser test runs against a
local fixture server (`pnpm --filter web test:widget`). The admin app is
separate:

```sh
cp apps/admin/.env.example apps/admin/.env
pnpm --filter admin dev   # http://localhost:3001
```

On a RAM-constrained machine, cap the dev server:

```sh
NODE_OPTIONS="--max-old-space-size=3072" taskset -c 0-2 pnpm --filter web dev
```

## Environment

Copy `apps/web/.env.example` to `apps/web/.env`. The full annotated list lives
there; the important groups are:

- **Core:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `NEXT_PUBLIC_BETTER_AUTH_URL`, `BASE_APP_URL` (plus optional
  `TRUSTED_ORIGINS` for preview deployments)
- **AI:** `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY`
- **Email:** `SMTP_*` (verification, password reset, campaigns, escalations)
- **Paystack:** `PAYSTACK_SECRET_KEY` (also verifies webhook signatures),
  price/plan codes
- **Sentry:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- **Scheduler:** `CRON_SECRET`

Admin credentials are deliberately separate. See `apps/admin/.env.example`;
never reuse `BETTER_AUTH_SECRET` there.

Never commit a filled `.env`. The repo ignores `.env` and commits only
`.env.example`.

## Commands

```sh
pnpm check-types          # every package, including next typegen
pnpm lint                 # every package; web lint also checks the widget build
pnpm test                 # Vitest suites
pnpm --filter web build   # production build for the customer app
pnpm --filter admin build # production build for the admin app

pnpm --filter web build:widget   # regenerate public/widget.js
pnpm --filter web check-widget   # fail if the committed widget is stale
pnpm --filter web test:widget    # real-browser widget E2E (needs Chrome)
```

`public/widget.js` is generated from `apps/web/widget/`. Never hand-edit it.
`pnpm --filter web lint` fails when the committed output is stale.

For the widget E2E, Chrome must be on `PATH` or `CHROME_BIN` must point at the
binary. CI sets this automatically.

## Database

From `packages/database`:

```sh
DATABASE_URL="postgresql://..." pnpm exec drizzle-kit generate
DATABASE_URL="postgresql://..." pnpm exec drizzle-kit migrate
```

`drizzle.config.ts` reads `DATABASE_URL` from the environment. You can either
export it for the command or create a gitignored `packages/database/.env`
containing just that variable. Do not point migration commands at production
without a backup.

## Widget

- Source: `apps/web/widget/`
- Built output (committed): `apps/web/public/widget.js`
- The engine/transport lives in `packages/widget-core`
- `pnpm --filter web build` and `dev` regenerate the widget automatically
- The browser test lives in `apps/web/scripts/widget-e2e.mjs`

## Observability and operations

- `GET /api/health` returns `200` with `{ status: "ok", database: "ok" }` when
  the app can reach Postgres, and `503` otherwise.
- Sentry wiring is in `sentry.server.config.ts`, `sentry.edge.config.ts`, and
  `instrumentation-client.ts`. Shared PII scrubbing is in
  `lib/sentry-shared.ts`.
- Database backups, the Neon 6-hour point-in-time window, and the restore drill
  are documented in [`docs/restore.md`](docs/restore.md).
- See [`docs/operations.md`](docs/operations.md) for the source-map token,
  alert rules, uptime monitor, and CI secrets.

## CI and scheduled checks

`.github/workflows/ci.yml` runs typecheck, lint, tests, the web build, and the
widget browser test on every PR and push to `main`. It needs no secrets; a
`SENTRY_AUTH_TOKEN` secret is optional and only affects source-map uploads.

`.github/workflows/uptime.yml` calls `/api/health` every 10 minutes. Set the
repository variable `APP_URL` (for example `https://app.example.com`) to enable
it; otherwise the job skips with a warning. GitHub may delay scheduled runs, so
pair it with a free UptimeRobot monitor if you need faster paging.

`.github/workflows/cron.yml` calls the campaign scheduler every 10 minutes
(and on manual dispatch). Set the repository variable `APP_URL` and the secret
`CRON_SECRET`; see [`docs/operations.md`](docs/operations.md#scheduler). The
endpoint claims each campaign with a conditional status update, so overlapping
runs skip a campaign another run already owns. Failed sends are retried after
15 minutes, and each run processes at most ten campaigns.

`.github/workflows/backup.yml` creates a compressed Neon dump every Monday at
03:00 UTC (and on manual dispatch) and uploads it as a private artifact with
14-day retention. Set the repository secret `DATABASE_URL` to the production
connection string; the workflow fails clearly if it is missing. The scripts,
verification queries, and the restore drill live in
[`docs/restore.md`](docs/restore.md).

## Deployment

The web app is a standard Next.js app and can run on Vercel or any Node host.
Set the variables from `apps/web/.env.example` in the host's environment, then
build with:

```sh
pnpm --filter web build
```

Deployment checklist:

1. Set all required env vars, including `BASE_APP_URL` and the auth URLs.
2. Apply migrations from `packages/database` before routing traffic.
3. Send one verification and one password-reset email to confirm SMTP and
   `BASE_APP_URL`; see `docs/operations.md`.
4. Add `SENTRY_AUTH_TOKEN` to the build environment so source maps upload.
5. Set the GitHub `APP_URL` variable and the `CRON_SECRET` secret, then run the
   uptime and cron workflows once.
6. Set the GitHub `DATABASE_URL` secret and run the **Database backup** workflow
   once; confirm the artifact appears. See [`docs/restore.md`](docs/restore.md).
7. Configure the Paystack webhook URL and verify it in test mode first.
8. Check your host's plan terms. Vercel Hobby is for non-commercial use; if you
   charge customers, use a plan or host that permits commercial traffic.

## Planning docs

- `plan/rebuild_divesai.md` — phase history and non-negotiables
- `plan/zero-budget-next-phase.md` — prioritized zero-budget improvements
- `plan/whats-next.md`, `plan/todo.md` — older roadmap notes (some are stale)
- `plan/widget-redesign-spec.md`, `plan/admin-roles-plan.md`,
  `plan/byoa-plan.md` — unimplemented designs
- `AGENTS.md` — contributor conventions and local machine quirks
