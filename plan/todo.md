# Todo

## Next up

Agreed after the documentation and test passes. In priority order.

### 1. Error tracking — Sentry

Nothing reports errors today: no Sentry, no error boundaries around the
dashboard or the API routes. A production 5xx is invisible until a customer
says so.

- [ ] Install `@sentry/nextjs` in `apps/web`
- [ ] Add `sentry.client.config.ts` and `sentry.server.config.ts`
- [ ] Add `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to `.env` and `turbo.json`
- [ ] Upload source maps on build (`next.config.js`)
- [ ] Error boundaries: `app/global-error.tsx`, `app/dashboard/error.tsx`,
      and one for the API routes
- [ ] Alert on 5xx spikes, chat API failures, webhook failures and AI
      provider errors

### 2. Live Paystack verification

The pricing page advertises real prices (GH¢119 / 399 / 749) and checkout
exists, but no real payment has been run end to end.

- [ ] Run a live checkout with `PAYSTACK_SECRET_KEY`
- [ ] Verify the webhook fires and the plan is applied to the domains
- [ ] Test upgrade, downgrade and cancel
- [ ] Verify a failed payment leaves the plan alone
- [ ] **Fix the copy**: the pricing page still says "Billing launches soon",
      which is no longer true
- [ ] Decide whether to remove the remaining Stripe env vars from `turbo.json`

### 3. Team polish

- [ ] A team switcher in the dashboard — domains are already shared with
      peers, but the dashboard always shows "your" view
- [ ] Onboarding creates a domain but not a team, so the Team tab stays empty
      for anyone who never visits it — decide whether to create a default team
      with the first domain

## Documentation

- [x] Fix `plan/documentation-site.md` line 170: change `data-domain` to `data-slug`
- [x] Fix `plan/documentation-site.md` line 174: change `data-greeting` to `data-title` / `data-subtitle`
- [x] Fix `plan/documentation-site.md` lines 370-371: update example snippet to use `data-slug` instead of `data-domain`
- [x] Fix attribute table (lines 167-174): add `data-title`, `data-subtitle`, `data-position`; remove `data-greeting`

The same fixes have been applied to the live docs in
`apps/web/content/docs/` — see the commit history for 2026-10-17.

## Docs still worth writing

- [ ] A page for the **teams** feature — done (`docs/teams.mdx`), but the team
      switcher in the dashboard still needs documenting when it exists
- [ ] An API key system does not exist yet, so the API reference documents
      what is really there (public endpoints + dashboard endpoints). Write the
      real thing when it is built.