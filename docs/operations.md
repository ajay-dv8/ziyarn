# Operations

This is the zero-budget operating runbook. It covers the parts that cannot be
configured from code: Sentry credentials and alert rules, the uptime monitor,
and CI variables.

## Sentry

The SDK is installed and verified. Two things still need a human with Sentry
access.

### 1. Upload source maps

Without an auth token, production stack traces are minified.

1. In Sentry, open **Settings → Auth Tokens** (organization tokens).
2. Create a token with source-map/release access. The narrowest useful set is
   `org:ci` plus the project release scope (`project:releases`); if your Sentry
   plan presents different names, choose the token type intended for CI release
   uploads.
3. Add it to the deployment environment as `SENTRY_AUTH_TOKEN` and to
   `apps/web/.env` for local release builds.
   - On Vercel: Project → Settings → Environment Variables, all environments.
   - In GitHub Actions: repository secret `SENTRY_AUTH_TOKEN` (optional; CI
     builds do not need it to pass).
4. Never prefix it with `NEXT_PUBLIC_`. It is server-only.

Verify by running a production build and checking that the Sentry plugin logs a
source-map upload. Then trigger a test error in a preview deployment and confirm
the stack frame names a real file and line.

### 2. Create alert rules

The free plan includes issue alerts. Metric alerts depend on the plan, so
create these in **Alerts** in the Sentry UI and skip any type the plan does not
offer:

1. **New issue** — any new issue in `ziyarn`; notify by email.
2. **Regression** — an issue marked resolved becomes unresolved.
3. **Server error spike** — metric alert on `http.status_code:5xx` (or the
   equivalent span/transaction filter) above a small threshold for 5 minutes.
   Start with a threshold high enough not to page on a single 502.
4. **Chat path** — issue alert filtered to `route:/api/chat` or the
   transaction/span name for chat. This is the revenue-critical path.
5. **Webhook failures** — issue alert filtered to `/api/webhooks/*` and
   `/api/billing/paystack/webhook`. A failed webhook can mean a customer paid
   and did not receive the plan.

Send alerts to email first. Add a Slack or Discord integration only if it is
free for the workspace; do not add a paid paging service.

### 3. Keep PII out

`apps/web/lib/sentry-shared.ts` disables default PII, removes user identity,
cookies, auth headers, cron/embed secrets, and portal tokens in query strings,
and scrubs emails and phone numbers from captured messages.

Do not enable:

- Session Replay
- request-body capture
- `includeLocalVariables`
- `sendDefaultPii`

Customer conversations are the product; Sentry must not become a second copy of
them.

## Uptime

`GET /api/health` checks Postgres with a 3-second timeout. It is public and
returns no secrets.

The GitHub Actions workflow `.github/workflows/uptime.yml` runs every 10
minutes. To enable it:

1. Repository → Settings → Secrets and variables → Actions → Variables.
2. Add `APP_URL` (for example `https://app.example.com`).
3. Run the workflow once with **Run workflow** and confirm it is green.

GitHub may delay scheduled runs and disables schedules after long repository
inactivity. For faster notification, add a free UptimeRobot HTTP(s) monitor on
`https://your-domain/api/health` with keyword `"status":"ok"` and email alerts.
Five-minute checks are enough for a small product.

If the health check fails, check in this order:

1. The deployment status on the host.
2. Neon project status and connection limits.
3. The web app's server logs for `health` or database errors.
4. `curl -i https://your-domain/api/health` from outside the host.

## CI

`.github/workflows/ci.yml` requires no secrets. It sets build-only placeholder
values for `DATABASE_URL` and `BETTER_AUTH_SECRET`; `next build` must not need a
real database. If a page starts querying the database at build time, the job
will fail — fix the page rather than adding production credentials.

Optional repository secret: `SENTRY_AUTH_TOKEN` for source-map uploads during
the CI build.

The widget job installs Chrome if the runner does not expose `google-chrome` and
sets `CHROME_BIN` for `apps/web/scripts/widget-e2e.mjs`.

## Scheduler (not wired yet)

`apps/web/app/api/campaigns/process-scheduled/route.ts` is guarded by
`x-cron-secret` and expects `CRON_SECRET`. Nothing calls it yet, so scheduled
campaigns do not send.

When wiring it (plan P0.1):

1. Set `CRON_SECRET` in the deployment and as a GitHub Actions secret.
2. Add a workflow with a 10-minute schedule that calls
   `GET $APP_URL/api/campaigns/process-scheduled` with
   `x-cron-secret: ${{ secrets.CRON_SECRET }}`.
3. Make the endpoint idempotent before enabling overlapping schedules.
4. Reuse the same workflow later for booking reminders and rate-limit pruning.

## Free-tier guardrails

- **Neon:** keep the rate-limit table pruned; watch storage and compute.
- **Sentry:** sample traces at 10% in production; do not enable replay.
- **GitHub Actions:** cache pnpm and Turborepo; cancel superseded runs.
- **AI:** per-domain daily caps are enforced in code; evals run offline.
- **Hosting:** check the plan's commercial-use terms before charging customers.
