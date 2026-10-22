# After Production — Deployment Follow-ups

Things that can only be verified or finished once a change is live.

---

## P0.9 — Enforce the CSP (flip Report-Only → enforcing)

**Status:** headers deployed 2026-10-22 in `1e02452`. The baseline headers
(nosniff, referrer policy, `X-Frame-Options: DENY`, permissions policy, HSTS)
are enforced now. The *CSP itself* is in rehearsal mode.

**What report-only means:** the browser receives the policy but does **not**
block anything. If a page loads a script/style/image/frame that isn't on the
list, it still works and the browser only writes a warning to its dev console.
Once the list is proven complete, renaming the header makes the browser
actually enforce it.

### Checklist

- [ ] **Watch for violations** on the real flows with DevTools open
      (F12 → Console). Look for `[Report Only]` / `Refused to ...` messages:
  - home, docs, pricing, features, sign-in / sign-up
  - dashboard: **upgrade / pay plan** (Paystack popup iframe)
  - a **portal payment** link
  - a **widget** embedded on a real customer site
  - admin app: sign-in and a couple of admin pages
  - Public-page scan on 2026-10-22 (headless Chrome, production): **0 violations**.
    The Paystack popup and portal payment still need a human to exercise them.
- [ ] **If a violation appears:** add that source to the CSP in
      `apps/web/next.config.js` (or `apps/admin/next.config.js`), redeploy, and
      restart the clean-day count. Do not flip while reports are appearing.
- [ ] **After ~3–7 clean days**, rename the header in **both**
      `apps/web/next.config.js` and `apps/admin/next.config.js`:

      Content-Security-Policy-Report-Only  →  Content-Security-Policy

      The value stays exactly the same.
- [ ] **Deploy, then smoke-test** the flows above with DevTools open. If
      anything breaks, rename it back and redeploy (reverting is safe and takes
      one change).
- [ ] **Verify the admin deployment** got the headers too:

      curl -sI <admin-production-url>/sign-in | grep -i content-security

- [ ] **Optional, later:** tighten `script-src` / `style-src` from
      `'unsafe-inline'` to nonces via `apps/web/proxy.ts`. This forces dynamic
      rendering, so only do it once the enforcing policy has been stable.

**Where violations show up:** the browser console only — there is no report
collector yet. Reference: `docs/operations.md` → “Security headers”.

---

## P0.7 — Paystack (deploy + dashboard follow-ups)

**Status:** the webhook fix was deployed 2026-10-22 (`0209515`). Before it,
production answered every Paystack delivery with `501 PAYSTACK_NOT_CONFIGURED`
because it verified signatures with a separate `PAYSTACK_WEBHOOK_SECRET` that
Paystack never signs with. Deliveries dropped during that window were not
applied and are not replayed.

### Checklist

- [x] **Deploy the fix and probe production** (2026-10-22): a valid
      secret-key signature answers `200 {"handled":false}`; a tampered body and
      a missing signature answer `400 PAYSTACK_SIGNATURE_INVALID`.
- [x] **Set the test-mode webhook URL** in the Paystack dashboard
      (`https://ziyarn.vercel.app/api/billing/paystack/webhook`). A real
      test-mode charge (`xrcce8t2wveeixd`, metadata `{"probe":true}`) was then
      sent to exercise delivery without writing data — confirm the 200 in the
      dashboard webhook log if it has not been checked yet.
- [ ] **Set the live-mode webhook URL** in the live dashboard before switching
      keys (test and live modes are separate).
- [x] **Hosted checkout smoke** (2026-10-22): upgrading through the Paystack
      popup with a test card set the account to `pro`/`active` and applied
      `pro` to both of its domains. This also doubles as the P0.9 CSP check for
      the popup iframe.
- [ ] **Reconcile button smoke**: start a checkout, close it after paying, press
      “restore/reconcile”, confirm the plan appears. (Covered against a branch
      by the live harness; not yet exercised in production.)
- [ ] **Before live keys:** re-run `services/api/src/paystack/live.test.ts`
      against a disposable Neon branch, confirm live dashboard prices match the
      advertised ones (watch for `priceDrifted` warnings), and clear the
      test-mode subscription left on the production account.

---

## Also pending (not CSP)

- [ ] **Payment rail decision (P0.7):** Stripe Connect (test mode is free) vs
      Paystack subaccounts/splits for portal product checkout. Decide, then
      record it in `plan/payments.md`.
- [ ] **Admin auth manual checks (P0.5):** sign-in lockout after 5 failures /
      15 min, and the 30-minute idle timeout. See
      `plan/zero-budget-next-phase.md` → P0.5.
- [ ] **Sentry manual setup (P0.2):** organization auth token for source maps,
      and alert rules in the Sentry UI. See `docs/operations.md` → Sentry.
