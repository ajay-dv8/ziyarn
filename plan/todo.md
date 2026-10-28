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

## Deferred — trigger-based

### Widget links Phase 3 — relative and in-page links

Do **not** implement now. Phase 3 is optional. **When:** after Phases 1–2 are
live and their acceptance checks pass. There is no scheduled date; at least one
of these triggers must also be true:

- a crawled page or product source supplies only a relative URL or bare slug;
- visitors need links found inside crawled pages to be clickable;
- product pages are client-rendered and only discoverable through a sitemap;
- a hard guarantee against invented URLs is required (known-URL allowlist or
  structured sources).

When triggered:

- [ ] Add `websiteUrl` to domains (or use the latest crawl job URL) and pass it
      to the system prompt.
- [ ] Resolve relative page/product URLs server-side against `websiteUrl`;
      keep the widget renderers absolute-only.
- [ ] Preserve links found inside crawled pages, preferably with a structured
      `links` column on `knowledgeDocuments` rather than appended text.
- [ ] Add sitemap.xml support only if client-rendered product pages cannot be
      discovered from crawlable links.
- [ ] Consider a known-URL allowlist (crawled pages + product URLs +
      tool-generated portal URLs) only if prompt-only generation proves
      insufficient.

If a data source only has a slug/handle, implement only the `websiteUrl` +
server-side normalization part; skip sitemap support and the allowlist until
there is evidence they are needed. Review this trigger during the Phase 2
acceptance check and the first data-source re-sync.

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