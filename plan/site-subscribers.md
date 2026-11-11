# Site subscribers — newsletter signup straight from the customer's website

Analysis + implementation plan. Decision: **v1 is an embeddable email signup
box** that writes into the existing customers table with `source = "site"` —
the same place CSV imports and chat captures already land, and the same list
Campaigns already sends to. **No new tables, no new sending system, no
migration.** Written after reading the customers service
(`services/api/src/customers/*`), the email/campaign service
(`services/api/src/email/server.ts`), the public API routes
(`apps/web/app/api/public/*`, `apps/web/app/api/chat/route.ts`), the widget
build pipeline (`apps/web/scripts/build-widget.mjs`,
`apps/web/widget/*`) and the dashboard Customers page.

## 1. What exists today

| Piece | Where | Status |
|---|---|---|
| Subscriber storage | `customers` table, unique `(domainId, emailLower)`, `source: chat \| database \| site`, `sourceLabel` | ✅ |
| Dedupe + upsert | `upsertCustomers()` in `services/api/src/customers/server.ts` (first provenance wins) | ✅ |
| Dashboard list | Customers page tabs: All / From chat / From database / **Subscribers** (`source = "site"`) | ✅ |
| CSV import | `customersService.import` → `source: "site"`, label "Imported list" | ✅ |
| Campaigns | `buildRecipientList(ownerId, audience)` reads customers, drops suppressed emails | ✅ |
| Unsubscribe + suppression | `unsubscribedEmails`, tokens in campaign mail, `/unsubscribe` route | ✅ |
| Chat capture | agent `capture_email` tool → lead **and** customer `source: "chat"` | ✅ |
| Widget auth | `x-embed-secret` header resolved to a domain (`resolveDomainBySecret`) | ✅ |
| Public API pattern | `apps/web/app/api/public/*`, CORS headers in `@repo/api/chat` | ✅ |
| Rate limiting | `SharedRateLimiter` + drizzle store (`apps/web/lib/rate-limit-db.ts`) | ✅ |

**Missing — the actual feature:** a public subscribe endpoint, an embeddable
signup form, and a dashboard snippet to copy. Everything downstream already
works: a row in `customers` is immediately visible under Subscribers and
reachable by Campaigns.

## 2. Design — v1

### Visitor flow

```
Customer's website footer
  <script src=".../subscribe.js" defer>
  <zy-subscribe data-slug="acme" data-secret="sec-..." data-heading="Get our newsletter">
        │
        ▼  POST /api/public/subscribe   (x-embed-secret header, { email, name? })
  validate secret → domain
  rate limit (IP + domain)
  upsertCustomers({ source: "site", sourceLabel: "Website form" })
        │
        ▼  { ok: true }  →  "Thanks — you're on the list."
Customers → Subscribers tab  ──►  Campaigns → send
```

### Snack-size decisions (defaults, change only with a reason)

- **Email only** in v1 (no name field). One input, one button.
- **Available on every plan.** Capturing is free; sending stays gated by
  `PLAN_LIMITS.emailsPerMonth` (free = 0), so capture is the upsell.
- **No auto-re-opt-in of unsubscribed emails.** If the address is on the
  suppression list it still upserts as a customer row, but campaigns skip it.
  This blocks "subscribe someone else's email" abuse until double opt-in ships.
- **First provenance wins** (existing behaviour): someone who first came via
  chat and later signs up stays `source: "chat"`, so they appear under "From
  chat", not "Subscribers". Accepted for v1.
- **No plan/domain config toggle** in v1 — the snippet only works where the
  owner pastes it.

### Endpoint — `POST /api/public/subscribe`

- File: `apps/web/app/api/public/subscribe/route.ts` (thin route, same pattern
  as `api/public/bookings/route.ts`).
- Business logic: `subscribe` in `services/api/src/customers/server.ts` +
  `subscribeSchema` in `services/api/src/customers/schemas.ts`
  (`z.object({ email: z.string().trim().email().max(320), name: optional })`).
- Auth: `x-embed-secret` — resolve domain, 403 on mismatch (same trust model
  as `/api/chat`; the secret is already public in every site's snippet and only
  permits subscribing, never reading).
- Rate limit: a second `SharedRateLimiter` (e.g. 10 per hour, key
  `subscribe:<domainId>:<ip>`) using the existing drizzle store; fail open with
  a Sentry warning like `chatRateLimiter`.
- Responses: `200 { ok: true }` for every valid secret (no email-exists
  enumeration), `400` invalid email, `403` bad secret, `429` rate limited.
- CORS: reuse `CORS_HEADERS` + an `OPTIONS` handler (arbitrary host pages).
- Dedupe/concurrency is already handled by `onConflictDoUpdate`.

### Embed script — `subscribe.js`

- Source: `apps/web/widget/subscribe.js` — a custom element `<zy-subscribe>`
  rendering into a **shadow root** so host-page CSS can't break it.
  Attributes: `data-slug`, `data-secret`, `data-heading` (optional),
  `data-button` (optional, default "Subscribe").
- Build: `apps/web/scripts/build-subscribe.mjs`, mirroring the widget build
  (inline CSS, self-contained output, no dependencies) → committed
  `public/subscribe.js`; add `--check` to the `apps/web` lint script next to
  `build-widget.mjs --check`.
- Behaviour: validates email client-side, disables the button while posting,
  replaces the form with the success message; on error shows one quiet line.
  Small and dependency-free (~2 KB).

### Dashboard — where the snippet lives

- New component `apps/web/components/dashboard/subscribe-snippet.tsx`, modeled
  on `components/domains/embed-snippet.tsx` (code block + copy button + note).
- Placement: **Customers page**, a card above the table
  ("Collect subscribers from your website"), using the page's already-selected
  domain. Needs the embed secret for that domain — fetch with
  `domainsService.getEmbedConfig(...)` (the domains page does the same).
- Snippet text (note `defer`, no `data-variant`-style config — form settings
  are per-domain server-side defaults for v1):

```html
<script defer src="https://<app>/subscribe.js"></script>
<zy-subscribe
  data-slug="acme"
  data-secret="sec-..."
  data-heading="Get our newsletter"
></zy-subscribe>
```

## 3. Steps (in order)

1. **Service + schema**
   - `subscribeSchema` in `services/api/src/customers/schemas.ts`.
   - `subscribe(db, { secret, email, name })` in
     `services/api/src/customers/server.ts`: resolve domain by `embedSecret`,
     `upsertCustomers({ source: "site", sourceLabel: "Website form" })`,
     return `{ domainSlug }`. Export through `customers/index.ts`.
2. **Public route**
   - `apps/web/app/api/public/subscribe/route.ts`: parse JSON, zod, secret
     header, rate limiter (`apps/web/lib/rate-limit-db.ts`), CORS + `OPTIONS`.
3. **Embed script**
   - `apps/web/widget/subscribe.js`, `apps/web/scripts/build-subscribe.mjs`,
     `public/subscribe.js`, `package.json` scripts (`build:subscribe`, extend
     `lint`).
4. **Dashboard snippet**
   - `subscribe-snippet.tsx` + Customers page card + `getEmbedConfig` fetch.
5. **Tests**
   - `services/api/src/customers/subscribe.test.ts` (vitest, following
     `chat/server.test.ts` style): valid secret inserts a `site` customer,
     duplicate email is idempotent, bad secret is rejected, unsubscribed email
     is not removed from suppression, source stays first-provenance.
   - Puppeteer smoke (as done for chat triggers): real test domain + secret →
     serve a blank page with the snippet → submit → row appears with
     `source = "site"`, "Subscribers" tab shows it, then delete the test rows.
6. **Gates**
   - `pnpm --filter @repo/api test`, `check-types` for api + web, `lint` (now
     also checks `public/subscribe.js` freshness), typecheck of the route types.

## 4. Deferred (phase 2+, not now)

- **Double opt-in** — confirmation email with token before the address counts
  (templates + sender already exist). This is the real fix for typo'd and
  abused addresses, and the prerequisite for safely re-opting unsubscribes.
- **Hosted signup page** (`/subscribe/<slug>`) for sites that can't add code.
- **Name field / custom fields**, and a per-domain "collect subscribers"
  toggle + heading/button copy in Settings.
- **Welcome email** and "new subscriber" dashboard notifications.
- **Bot protection** beyond rate limits (honeypot field is cheap and enough
  for v2; CAPTCHA only if abuse actually shows up).

## 5. Risks / notes

- **Spam/stuffing**: the endpoint is public by design. Rate limiting + always-
  `ok` responses + suppression list keep blast radius small; double opt-in is
  the definitive fix, hence phase 2.
- **Fake/typo emails** hurt deliverability. Bounce handling exists in the
  campaign pipeline? — verify while implementing; if not, note it as a
  follow-up (soft/hard bounce suppression).
- **Duplicated secret exposure**: `public/subscribe.js` is served from the same
  origin as the widget; secret in HTML is already the model. No new exposure.
- **Source semantics**: subscribers who were already chat customers won't show
  under "Subscribers" (first provenance wins). Documented, not fixed in v1.
- **Build artifact**: `public/subscribe.js` must be committed and kept fresh —
  the lint `--check` enforces it, matching the widget.
- **No migration** anywhere in this plan.

## 6. Estimate

Half a day: service + route (~1–2 h), embed script + build (~1–2 h), dashboard
card (~1 h), tests + e2e (~1–2 h).
