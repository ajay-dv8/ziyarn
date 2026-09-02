# What's Next — Task Roadmap

All 13 product phases are complete. These are the remaining items
to get the platform production-ready and user-friendly.

---

## Priority 1: Live Stripe/Resend Verification

**Effort:** 1 session | **Priority:** High | **Blocks:** Production launch

All billing and email features work in code but have never been
E2E tested with real credentials.

### Tasks

- [ ] **Stripe live key verification**
  - Set real `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  - Create a live Stripe Checkout session
  - Verify webhook fires on payment success
  - Verify plan upgrade applied to domain after payment
  - Test upgrade/downgrade flows
  - Test credit purchase flow

- [ ] **Resend live key verification**
  - Set real `RESEND_API_KEY`
  - Send a test campaign email
  - Verify delivery webhook fires
  - Verify bounce/complaint handling
  - Test booking confirmation email end-to-end
  - Test payment receipt email end-to-end

- [ ] **Edge cases**
  - Test expired card handling
  - Test webhook replay protection
  - Test email rate limiting
  - Verify all email templates render correctly in major clients

### Files involved
- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/app/api/webhooks/resend/route.ts`
- `services/api/src/billing/server.ts`
- `services/api/src/email/server.ts`
- `.env` (live keys)

---

## Priority 2: Sentry Integration

**Effort:** 30 min | **Priority:** High | **Blocks:** Production monitoring

The roadmap calls this "non-negotiable." Pino logging exists but
there is no error tracking or alerting service.

### Tasks

- [ ] Install `@sentry/nextjs`
- [ ] Run `npx @sentry/wizard@latest -i nextjs`
- [ ] Configure `sentry.client.config.ts` and `sentry.server.config.ts`
- [ ] Add `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to env
- [ ] Add source map upload to build
- [ ] Set up error boundaries for:
  - Dashboard layout
  - Chat widget
  - API routes
- [ ] Configure alert rules for:
  - 5xx error rate spike
  - Chat API failures
  - Webhook processing errors
  - AI service failures (provider errors, rate limits)

### Files involved
- `apps/web/sentry.client.config.ts` (new)
- `apps/web/sentry.server.config.ts` (new)
- `apps/web/next.config.js` (add Sentry webpack plugin)
- `apps/web/app/global-error.tsx` (new)
- `.env` (SENTRY_DSN, SENTRY_AUTH_TOKEN)
- `turbo.json` globalEnv

---

## Priority 3: Documentation Content

**Effort:** Ongoing (15-20 hrs) | **Priority:** High | **Blocks:** User self-service

The Fumadocs framework is set up with 17 MDX pages, but all content
is placeholder stubs. Real guides need to be written.

### Core content (do first)

- [ ] **Getting Started** — Quick start: sign up, create domain, add agent, embed widget. Step-by-step with screenshots.
- [ ] **Widget Integration** — Copy-paste HTML, React, Vue, Svelte, Angular, WordPress, Shopify. CSP headers. TypeScript config. Mobile responsive behavior.
- [ ] **Database Integration** — Connect Postgres, MySQL, MongoDB, Convex. Schema detection. Query builder. Security model. Performance tips.
- [ ] **Domain Management** — Create, configure, custom domains. Embed secrets. Plan limits.

### Feature docs

- [ ] **Agents** — Create, configure system prompt, instructions, tools, per-domain setup.
- [ ] **Knowledge Base** — Upload files, crawl pages, embeddings explained, supported formats, size limits.
- [ ] **Products & Payments** — Add products, Stripe integration, checkout flow, payment webhooks.
- [ ] **Bookings** — Calendly-style booking, availability setup, confirmation emails.
- [ ] **Campaigns** — Email campaign builder, scheduling, delivery tracking, segmentation.
- [ ] **Conversations** — Real-time chat, escalation, owner notifications, unread badges.
- [ ] **Customers** — Customer list, conversation history, booking history.
- [ ] **Analytics** — Dashboard metrics, conversation trends, booking trends.
- [ ] **Billing** — Plans, credits, usage metering, Stripe checkout.
- [ ] **Integrations** — Webhooks, API keys, third-party connections.

### Developer docs

- [ ] **API Reference** — REST endpoints, authentication, rate limits, error codes.
- [ ] **Webhooks** — Event types, payload formats, retry policy, signature verification.
- [ ] **Deployment** — Vercel deploy, self-hosted, Docker, env vars reference.

### Polish

- [ ] Add screenshots and diagrams to all pages
- [ ] Verify all code examples work
- [ ] Link checker across all pages
- [ ] Search index verification
- [ ] Mobile responsive check
- [ ] OpenGraph images for social sharing
- [ ] Changelog page updates

---

## Priority 4: Conversational Onboarding Flow

**Effort:** 4-6 hrs | **Priority:** Medium | **Blocks:** New user activation

A 6-step guided setup wizard for new users after sign-up.

### Steps

1. **Domain name** — "What's your business name?"
2. **Domain slug** — Auto-generated from name, editable
3. **Logo** — Upload or skip (schema: `domains.logoUrl` column needed)
4. **Agent name** — "What should your AI assistant be called?"
5. **Agent description** — "What does your business do?"
6. **Knowledge upload** — Upload files or skip

### Tasks

- [ ] Create `app/onboarding/layout.tsx` (step machine layout)
- [ ] Create step components: `components/onboarding/step-{1..6}.tsx`
- [ ] Add `domains.logoUrl` column (migration)
- [ ] Implement step state machine (URL-based: `/onboarding?step=2`)
- [ ] Wire sign-up redirect: `/sign-up` → `/onboarding?step=1` (instead of `/dashboard`)
- [ ] Skip logic: "I'll do this later" button on each step
- [ ] Complete: redirect to `/dashboard` with welcome toast
- [ ] Add onboarding completion check in dashboard layout (redirect if not complete)

### Files involved
- `apps/web/app/onboarding/` (rewrite)
- `apps/web/components/onboarding/` (new)
- `packages/database/src/schema/domains.ts` (add `logoUrl`)
- `packages/database/drizzle/0024_logo_url.sql` (new)
- `services/api/src/domains/server.ts` (add `logoUrl` to create/update)
- `apps/web/app/(auth)/sign-up/page.tsx` (redirect logic)

---

## Priority 5: Agent Identity & Personalization

**Effort:** 1-2 hrs | **Priority:** Low | **Blocks:** Nothing

Two TODOs in `apps/web/app/api/chat/route.ts`:

1. **User identification** (line 28):
   > "Find a way to identify users/customers of the company or get
   > information such as name and email of new users to provide a
   > more personalized experience"

2. **Per-agent system prompt override** (line 29):
   > "Make this configurable per agent, and allow the agent to
   > override it with their own system prompt"

### Tasks

- [ ] Add optional customer metadata fields to chat API request
  (`customerName`, `customerEmail`, `customerPhone`)
- [ ] Pass metadata through to AI system prompt
- [ ] Store customer metadata in conversation record
- [ ] Verify agent `systemPrompt` field already overrides default
  (may already work — check current logic)

### Files involved
- `apps/web/app/api/chat/route.ts`
- `packages/database/src/schema/index.ts` (conversations table)

---

## Priority 6: Native Chat SDKs

**Effort:** Large | **Priority:** Low | **Blocks:** Nothing

The roadmap mentions "native chat SDKs (mobile/desktop)" with a
"transport-agnostic API."

### Future exploration

- [ ] React Native SDK for mobile apps
- [ ] Flutter SDK
- [ ] Electron wrapper for desktop
- [ ] Transport layer: WebSocket option alongside SSE
- [ ] Offline message queue
- [ ] Push notification integration

This is a future initiative — the current widget covers web.

---

## Execution Order

```
Phase 1: Live Stripe/Resend verification    ← DO FIRST
Phase 2: Sentry integration                 ← DO SECOND (30 min)
Phase 3: Documentation content              ← ONGOING (parallel)
Phase 4: Conversational onboarding          ← WHEN READY
Phase 5: Agent identity/personalization     ← QUICK WIN
Phase 6: Native chat SDKs                   ← FUTURE
```

Phase 1 + 2 should be done together in one session — they're both
prerequisites for production launch and are small enough to batch.
