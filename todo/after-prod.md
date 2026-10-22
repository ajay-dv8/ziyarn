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

## Also pending (not CSP)

- [ ] **Admin auth manual checks (P0.5):** sign-in lockout after 5 failures /
      15 min, and the 30-minute idle timeout. See
      `plan/zero-budget-next-phase.md` → P0.5.
- [ ] **Sentry manual setup (P0.2):** organization auth token for source maps,
      and alert rules in the Sentry UI. See `docs/operations.md` → Sentry.
