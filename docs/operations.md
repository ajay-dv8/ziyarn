# Operations

This is the zero-budget operating runbook. It covers the parts that cannot be
configured from code: Sentry credentials and alert rules, the uptime monitor,
database backups, and CI variables.

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

## Backups

`.github/workflows/backup.yml` runs every Monday at 03:00 UTC and on manual
dispatch. It installs the PostgreSQL 18 client, runs
`scripts/backup-db.sh` against the production database, validates the custom
dump with `pg_restore --list`, and uploads it as a private GitHub Actions
artifact with 14-day retention.

Setup:

1. Repository → Settings → Secrets and variables → Actions → Secrets.
2. Add `DATABASE_URL` with the production Neon connection string (including
   `sslmode=require`). Do not reuse the CI placeholder.
3. Run **Database backup** once with **Run workflow** and confirm a
   `neon-backup-<run-id>` artifact appears.

The first manual run (2026-10-22) completed successfully and uploaded an
artifact; the weekly schedule now runs automatically.

Neon's free plan keeps a **6-hour** point-in-time window
(`history_retention_seconds: 21600`). Use PITR for mistakes caught quickly and
the weekly artifact for anything older. The full restore procedure, the
row-count check, and the 2026-10-22 drill record are in
[`docs/restore.md`](restore.md).

The backup script requires `pg_dump` and `pg_restore` from PostgreSQL 18; an
older client refuses a PostgreSQL 18 server. Use the branch's direct
(non-pooler) host for `pg_restore` and verification queries.

## CI

`.github/workflows/ci.yml` requires no secrets. It sets build-only placeholder
values for `DATABASE_URL` and `BETTER_AUTH_SECRET`; `next build` must not need a
real database. If a page starts querying the database at build time, the job
will fail — fix the page rather than adding production credentials.

Optional repository secret: `SENTRY_AUTH_TOKEN` for source-map uploads during
the CI build.

The widget job installs Chrome if the runner does not expose `google-chrome` and
sets `CHROME_BIN` for `apps/web/scripts/widget-e2e.mjs`.

## Scheduler

`GET /api/campaigns/process-scheduled` sends every campaign whose scheduled
time has arrived and prunes expired chat rate-limit windows.
`.github/workflows/cron.yml` calls it every 10 minutes and on manual dispatch.

### Configure

1. Generate a secret:
   ```sh
   openssl rand -hex 32
   ```
2. Set `CRON_SECRET` in the deployment environment (the same value the endpoint
   reads at runtime).
3. Repository → Settings → Secrets and variables → Actions:
   - Secret `CRON_SECRET`: the same value as step 2.
   - Variable `APP_URL`: the production origin, for example
     `https://app.example.com`.
4. Run the **Cron** workflow once with **Run workflow**. A missing variable or
   secret fails the job with an explicit error rather than silently skipping.

The endpoint returns `503 SCHEDULER_NOT_CONFIGURED` when `CRON_SECRET` is
missing and `401 UNAUTHORIZED` when the header does not match. The comparison
is timing-safe.

### What a run does

- Selects up to ten campaigns with `status = 'scheduled'` and a due
  `scheduled_at`, oldest first.
- Claims each one with a conditional `UPDATE … WHERE status = 'scheduled'`.
  If another run wins the race, the campaign is counted as `skipped` and is not
  sent.
- Sends the claimed campaign, marks it `sent`, and records per-recipient
  results.
- On failure, puts the campaign back to `scheduled` with a retry time 15 minutes
  out. A persistent failure does not leave it stuck in `sending`.
- Deletes `rate_limit_windows` rows older than the current 60-second window, so
  the shared chat counter stays small.
- Returns
  `{ "sent": number, "failed": number, "skipped": number, "rateLimitWindowsPruned": number }`.
  A pruning failure is logged but does not stop campaign delivery.

Manual sends use the same claim, so a double click cannot send twice.
This is at-most-once for overlapping runs. A process crash after some recipients
have received mail can still require manual review; add a durable per-recipient
queue before scaling beyond small audiences.

### Verify it works

Use a test campaign with one internal recipient, not a real customer list:

1. Schedule it for one minute in the future.
2. Run the **Cron** workflow from the Actions tab.
3. Confirm the response reports `sent: 1` and the campaign badge changes from
   `scheduled` to `sent`.

You can also call it directly:

```sh
curl --fail-with-body \
  -H "x-cron-secret: $CRON_SECRET" \
  "$APP_URL/api/campaigns/process-scheduled"
```

Sending is serial and the route declares `maxDuration = 60` for serverless
hosts. Very large audiences can outlive a single invocation; the ten-campaign
cap protects the tick, but moving delivery to a durable queue is the next step
if lists grow.

GitHub may delay scheduled runs. This is a backstop for campaigns, not an exact
delivery-time guarantee.

## Auth email and sessions

Verification and password reset use the same SMTP configuration as campaigns.
Set these in the **web** deployment (not the admin app):

- `BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL`: the public app origin,
  for example `https://ziyarn.vercel.app`.
- `BASE_APP_URL`: the origin used in email links. In production it should equal
  the public app origin; if it is blank the code falls back to
  `BETTER_AUTH_URL`.
- `TRUSTED_ORIGINS`: optional comma-separated extra origins for previews. The
  URLs above are trusted automatically.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

A missing SMTP configuration does not fail sign-up or a reset request; it logs
`Auth email delivery failed` and the request still returns the generic response.
Check the function logs and SMTP credentials when a user reports no message.

### Verify a real lifecycle

Use a mailbox you control, then check the full path after a deployment:

1. Sign up and confirm the verification email arrives. The link must use the
   production `BASE_APP_URL`, not localhost.
2. Open the link, click **Verify email**, and confirm the dashboard banner
   disappears.
3. Sign out, choose **Forgot password?**, and request a reset. Confirm an unknown
   address receives the same “if an account exists” message as a known one.
4. Open the reset link, set a new password, and confirm the old password no
   longer signs in. Reusing the same reset link must fail.
5. Wait past one hour (or shorten the token TTL in a test deployment) and
   confirm the expired link is rejected.

### Limits

| Surface | Limit |
|---|---|
| Customer email sign-in | 10 attempts / 15 min per IP |
| Customer sign-up | 5 / hour per IP |
| Reset request | 3 / 15 min per IP |
| Verification resend | 3 / 15 min per IP |
| Admin email sign-in | 5 attempts / 15 min per IP |
| Admin idle session | 30 min without activity |
| Public chat | 10 messages / 60 sec per visitor per domain |

Auth limits use Better Auth's in-memory store, so each serverless instance has
its own counter. They are a credential-stuffing speed bump, not a shared quota;
revisit auth if abuse spans instances.

Public chat limits are shared through the `rate_limit_windows` Postgres table.
An in-memory limiter still checks bursts first, then one atomic upsert in Neon
increments the shared count. The count therefore survives deploys and spans
serverless instances. If the database check fails, chat fails open and Sentry
receives a warning; per-domain daily caps and plan limits still apply. The
scheduler deletes closed windows every ten minutes.

Admin sessions are sliding: activity within the last 30 minutes renews the
cookie, and five minutes is the minimum renewal interval.

## Free-tier guardrails

- **Neon:** keep the rate-limit table pruned; watch storage and compute.
- **Sentry:** sample traces at 10% in production; do not enable replay.
- **GitHub Actions:** cache pnpm and Turborepo; cancel superseded runs.
- **AI:** per-domain daily caps are enforced in code; evals run offline.
- **Hosting:** check the plan's commercial-use terms before charging customers.
