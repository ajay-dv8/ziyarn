# P0 Remaining — Zero-Budget Launch-Safety Plan

**Created:** 2026-10-22
**Status at creation:** production runs `0209515`; `/api/health` is `ok`; Paystack test-mode
matrix is green and the webhook fix is deployed. Six of ten P0 items are complete.
Everything below is still $0.

> Consolidated view only. Detail and history live in
> `plan/zero-budget-next-phase.md` (P0 section) and `todo/after-prod.md`.

## 1. Payment rail decision (P0.7 — the big one)

Decide how portal **product** checkout works. Subscriptions already use Paystack and
are verified; this is the “agent sells a product” path, which currently falls back to
“pay by email” because Stripe Connect has no keys.

- [ ] Choose one:
  - **Option A — Stripe Connect:** configure test keys, keep the existing portal code.
    Live fees apply. Reuses what exists but adds a second processor and a USD/EUR
    checkout in a GHS market.
  - **Option B — Paystack subaccounts/splits:** move product checkout to Paystack so
    Ghanaian customers pay in GHS and payouts are automated. More work, removes the
    unconfigured Stripe dependency.
- [ ] Write `plan/payments.md`: decision, rationale, env vars, webhook events,
      idempotency, payout/split behavior, and migration notes.
- [ ] If Paystack is the only rail: delete the unused Stripe checkout/webhook routes
      and their docs. Do **not** remove Stripe subscription env vars until the
      dashboard has a single subscription path.
- [ ] Unblocks P2.4 (payment rail completion / BYOA).

**Done when:** the rail is documented and portal checkout works end to end in test
mode against it.

## 2. Sentry manual setup (P0.2)

Code is done (SDK, PII scrubbing, dashboard error capture); these are dashboard steps.

- [ ] Create a Sentry organization auth token with `org:ci` and project release
      scopes. Set `SENTRY_AUTH_TOKEN` in Vercel (all environments) and locally.
      Never commit it.
- [ ] Confirm a production build uploads source maps and a deliberate test error
      shows original file/line names.
- [ ] Add alert rules: new issue, regression, 5xx rate spike, errors tagged
      `route:/api/chat`, and webhook failures (`/api/webhooks/*`,
      `/api/billing/paystack/webhook`). Route to email first.
- [ ] Verify no PII appears in an event and expected 4xx control-flow errors are
      ignored.

**Done when:** a production issue has a readable first-party frame, an alert email
arrives, and events contain no PII.

## 3. Admin auth manual checks (P0.5)

Code is in place; confirm the two behaviors by hand in the admin app.

- [ ] Five failed sign-ins within 15 minutes trigger the lockout.
- [ ] A session logs out after 30 minutes of inactivity (sliding window).

**Done when:** both behaviors are observed and noted here / in `todo/after-prod.md`.

## 4. CSP enforcement (P0.9)

Report-only window started 2026-10-22. Do not flip while violations are appearing.

- [ ] Let the policy ride report-only for ~3–7 clean days. Watch the browser console
      (`[Report Only]` / `Refused to ...`) on: home, docs, pricing, features,
      sign-in/up, dashboard, **billing popup**, **portal payment link**, widget
      embedded on a real page, and the admin app.
- [ ] Rename the header in **both** `apps/web/next.config.js` and
      `apps/admin/next.config.js`:
      `Content-Security-Policy-Report-Only` → `Content-Security-Policy` (value
      unchanged).
- [ ] Deploy, then smoke-test the flows above. If anything breaks, rename it back.
- [ ] Verify the admin deployment also serves the header
      (`curl -sI <admin-url>/sign-in | grep -i content-security`).
- [ ] Optional later: replace `'unsafe-inline'` with nonces via `apps/web/proxy.ts`
      (forces dynamic rendering; only after the enforcing policy is stable).

**Done when:** the enforcing CSP is live on both apps and the main flows are clean.

## 5. Pre-live Paystack cleanup (P0.7)

- [ ] Set the webhook URL in the **live** dashboard (test and live modes are separate):
      `https://ziyarn.vercel.app/api/billing/paystack/webhook`.
- [ ] Confirm the dashboard webhook log shows **200** for the probe charge
      `xrcce8t2wveeixd` (metadata `{"probe":true}`, ~2026-10-22 19:14:45 UTC).
- [ ] Reconcile smoke in production: start a checkout, close it after paying, press
      “restore/reconcile”, confirm the plan appears.
- [ ] Before switching keys: re-run `services/api/src/paystack/live.test.ts` against a
      fresh disposable Neon branch (`PAYSTACK_LIVE_TEST=1`), confirm live dashboard
      prices match the advertised ones (watch `priceDrifted`), and clear the test-mode
      `pro` subscription left on the production account.
- [ ] Live webhook URL + live keys, then one small real charge to confirm the live
      path end to end.

**Done when:** live mode is configured, the test-mode artifacts are cleared, and a
real charge lands with the plan applied via webhook.

## 6. Live charge (deliberately deferred)

Do not run until it is acceptable to pay the processor fee (and refund it if needed).

- [ ] Decide when the first live charge is acceptable.
- [ ] Send one small live charge, confirm the webhook, plan state, receipt, and
      refund path.

**Not a launch blocker.** Test mode covers the logic.

---

## Suggested order

1. Payment rail decision (unblocks P2.4 and the last product gap).
2. Sentry token + alert rules.
3. Admin auth checks.
4. CSP flip once the clean window elapses.
5. Pre-live Paystack cleanup, then the first live charge when acceptable.
