# Ziyarn Rebuild Roadmap
From divesai to ziyarn

Source of truth for the rebuild of https://github.com/ajay-dv8/divesai
(an AI sales/helpdesk chatbot platform) into the ziyarn monorepo.

---

# 1 What divesai does

Businesses embed an AI chatbot widget on their site. The widget:

- identifies customers by email during the conversation
- runs an OpenAI sales conversation guided by per-domain "filter questions"
- escalates to a human via realtime chat (Pusher) when out of scope
- emits booking / payment portal links (Stripe Connect, GHS)
- captures leads, bookings, payments and answered questions

Owners manage domains from a dashboard: chatbot config, FAQ (helpdesk),
filter questions, products, appointments, email marketing campaigns,
conversations, Stripe Connect, plan limits (STANDARD / PRO / ULTIMATE).

# 2 What we keep

- Core product concept: embeddable AI agent, per-domain config,
  filter-question lead capture, realtime human escalation, booking +
  payment portals, plan-based limits
- Embed via iframe + postMessage (works everywhere, simple)
- OpenAI chat completions as the engine (upgraded, see section 4)
- Stripe as payments (connected accounts for payouts)
- Email marketing campaigns to captured customers

# 3 What we drop / replace

Drop:
- Clerk -> Better Auth (already wired: email/password + OAuth-ready)
- Prisma -> Drizzle + Neon (already wired, 14 tables pushed)
- Module-level `let customerEmail` identity state -> persisted per-session
- Keyword-marker prompt hacks `(complete)` / `(realtime)` -> tool calling
- gpt-3.5-turbo -> configurable model, default gpt-4o class, streaming
- Nodemailer Gmail SMTP -> Resend API (transactional + marketing, webhooks)
- Uploadcare -> app-owned uploads (local dev / S3 in prod)

# 4 What we fix (divesai defect list)

Security:
- Bot conversation endpoint must be public (widget) BUT domain-gated by a
  secret + rate-limited per domain/IP. No unlimited OpenAI burn.
- Every server action must verify ownership (domain belongs to session user).
- Portal routes must be non-guessable (signed customer tokens), no PII leak.
- Pusher channels must be private + authorized (or use SSE; decision in P4).
- Server-side zod validation on every action + API route. No raw inputs.
- Never expose secrets via NEXT_PUBLIC_*.

Correctness:
- Booking lookup bug (customerid passed as domainId) — fixed by typed services.
- Stripe Connect dead route — real /api routes or server actions with webhooks.
- credits going negative — checked before decrement, atomic.
- Plan limits inconsistent across UI/actions — single source in plan service.
- Hardcoded divesai.vercel.app URLs — all URLs from env (BETTER_AUTH_URL etc).
- Currency inconsistencies (GHS vs $) — fixed in P9 via @repo/money + registry.

AI quality:
- Tool calling for structured actions (book, pay, escalate, capture email).
- Conversation memory persisted in DB (messages table) + context windowing.
- Helpdesk FAQ + knowledge base injected via RAG (embeddings table exists).
- Streaming responses to the widget.
- Prompt templates per agent type (helpdesk / sales) from agent config.

# 5 Architecture mapping (divesai -> ziyarn)

divesai                        ziyarn
User / ClerkId                 user (better-auth) + users profile
Domain                         domains (new table, ownerId -> user.id)
ChatBot config                 agents (name, system_prompt, instructions,
                               tools, knowledge_source_ids)
HelpDesk FAQ                   knowledge_documents + document_chunks
FilterQuestions                agents.filter_questions (jsonb) or dedicated
Customer                       leads (+ email + answers jsonb)
ChatRoom / ChatMessage         conversations + messages (roles incl tool)
Bookings                       bookings table (new)
Product + Stripe Connect       products + connected_account on user
Campaign / bulk mail           email_marketing tables (new)
Billings (plan/credits)        subscriptions/plans (new, Stripe webhook)
Pusher realtime                decision P4 (private pusher or SSE)
AI call                        services/ai (tool-calling, streaming, RAG)
Widget                         apps/widget (new, iframe target) or
                               apps/web/chatbot route

# 6 Phased roadmap

Every phase ends verified: check-types + lint clean, feature exercised
against the running dev server.

P1 Platform foundation (done)
- Better Auth on Drizzle/Neon (done), sign-in/sign-up/logout (done)
- services/api auth service (done)
- E2E verify auth flow (done)

P2 Domains (done)
- domains table + CRUD services (zod schemas, owner-scoped) (done)
- plan limits service (single source for domain/credits limits) (done)
- settings UI: create/rename/delete domain (done; embed snippet config endpoint
  + snippet/copy UI shipped with the P3 widget)
- Done when: domain CRUD verified owner-only via curl + UI (done)

P3 Agent pipeline (the core)
- agents CRUD + agent config service (done: services/api/agents, owner-scoped)
- chat API route (public): domain secret + rate limit (done: /api/chat POST+GET,
  x-embed-secret, in-memory sliding window per visitor, SSE streaming, 401/403/
  404/429/503 error codes; E2E verified 14/14)
- services/ai: multi-provider chat (Gemini primary, OpenRouter fallback),
  tool calling (capture_email, book_appointment, create_payment, escalate,
  answer_knowledge), streaming
  (done: @repo/ai streamChat generator, tool loop up to 5 rounds; verified
  live E2E 11/11 with gemini-3.6-flash + openai/gpt-oss-20b:free fallback)
- messages persisted + context windowing (done: conversations/messages, status
  active/escalated/resolved/closed, visitor_id, 20-message context window)
- knowledge base upload -> embeddings (pgvector or neon vector) + retrieval
  (done: P3b — embeddings.embedding vector(1536) + HNSW cosine index
  (0004_knowledge_embeddings), services/ai embed() (gemini-embedding-001,
  1536-dim via matryoshka truncation, no OpenAI key needed),
  services/api knowledge service (upload/list/delete/query, owner-scoped,
  chunker 900 chars/120 overlap, `1 - (embedding <=> q)::vector` cosine
  search, default minScore 0.5 for matryoshka-truncated vectors), chat
  answer_knowledge tool wired to retrieval; live E2E 11/11 verified on Neon
  with real Gemini embeddings)
- widget (done: P3c — Shadow DOM web component (NOT iframe), works in
  WebViews of mobile/desktop apps, not just browsers; chat API stays
  transport-agnostic (REST + SSE) so native SDKs can call it directly;
  /widget.js <zy-widget> with launcher, panel, SSE streaming, history restore
  + conversation persistence, escalation banner; CORS + public config on
  /api/chat; embed snippet UI + live preview on the Domains page; verified via
  curl: preflight 204, config, SSE stream, history)
- Done when: widget holds a full sales + helpdesk conversation,
  escalates, persists, and streaming renders (done — API E2E 14/14 earlier,
  widget path verified live on urban-plus)

P4 Realtime escalation + owner messenger (done)
- decision (done): SSE delta-stream over Postgres — no broker. /api/chat
  GET with `since`+`stream=1` holds up to ~8s polling Neon for new messages,
  pushes `message` events, closes; clients reconnect immediately
  (serverless-safe, ~1s latency, zero new deps). Pusher is a transport
  swap behind the same endpoint later.
- schema (done): messages.sender (visitor/owner/assistant) + backfill,
  conversations.owner_seen_at (migration 0005_p4_realtime)
- chat service (done): owner-scoped listConversationsForOwner (last message
  + unread), getConversationForOwner, listMessagesSince, appendOwnerMessage
  (ownership + closed guard), markConversationSeen, setConversationStatus
  ForOwner; appendMessage now records sender
- API (done): GET /api/chat auth modes (embed secret = visitor, session =
  owner), delta SSE stream, `since` JSON fallback
- widget (done): delta listener after escalate/done + on escalated history,
  "Owner" bubbles, config URL fixed (/api/chat not /api/chat/config)
- dashboard conversations page (done): list + unread badge + messenger with
  EventSource delta, reply action, resolve/close/reopen, 10s list poll
- realtime toggle from agent tool call (done: escalate tool already flips
  status; widget enters human mode on the escalate event)
- clock skew (done): cursors come from serverTime in done/history responses,
  never client Date.now() — Neon server clock trails local
- E2E (done): node harness delivered mid-stream owner insert (message event);
  headless Chrome with the real widget confirmed real SSE fetch → parse →
  owner bubble render + serverTime cursor advance (15 events in one stream);
  history renders owner bubbles; web + @repo/api typecheck/lint green

P5 Customer portal
- signed portal URLs (token in query, expires)
- appointment booking flow (questions -> calendar -> slots -> confirm)
- product checkout (Stripe PaymentElement on connected account) + webhook
  to confirm payment, create leads + bookings atomically
- Done when: full booking + payment path verified end-to-end
- decision (done): chat-driven booking + confirm page — agent collects
  date/time/topic, creates pending booking, returns signed URL; visitor
  reviews + confirms on /portal/booking. No calendar/date-picker UI in P5.
- decision (done): build without Stripe keys first — graceful degradation
  (PAYMENTS_NOT_CONFIGURED/CONNECTED_ACCOUNT_REQUIRED → "link by email"
  message) until STRIPE_* env vars + Connect accounts exist
- schema (done): bookings + payments + stripe_accounts (migration
  0006_p5_portal, CHECK constraints on status, FKs, indexes)
- portal service (done): HMAC-SHA256 signed tokens (base64url payload
  {type,id,domainId,exp}, 7d TTL, PORTAL_URL_SECRET ?? BETTER_AUTH_SECRET),
  createBooking (slot uniqueness 409 SLOT_UNAVAILABLE), confirmBooking
  (idempotent), getBookingByToken/getPaymentByToken, createPaymentRequest,
  createPaymentIntent (dynamic stripe import, connected account +
  application_fee_amount), handleStripeWebhook (payment_intent.succeeded →
  tx marks paid + confirms linked booking + upserts lead)
- API (done): POST /api/portal/booking (confirm), GET/POST /api/portal/pay
  (info / intent), POST /api/webhooks/stripe (raw body + signature)
- chat wiring (done): book_appointment + create_payment tool executors
  return real signed URLs; SLOT_UNAVAILABLE handled with an offer prompt
- portal pages (done): /portal/booking (summary + confirm, confirmed state),
  /portal/pay (amount/status, graceful no-keys message, paid state)
- env (done): STRIPE_SECRET_KEY/PUBLISHABLE_KEY/WEBHOOK_SECRET/
  APP_FEE_BASIS_POINTS + PORTAL_URL_SECRET/BASE in turbo.json globalEnv;
  stripe dep added to @repo/api; PORTAL_URL_BASE ?? BETTER_AUTH_URL
- E2E (done): real signed token → /portal/booking renders (date/time/topic/
  domain) → confirm API idempotent (confirmed twice) → /portal/pay renders
  ($99.00, pending) → intent API 501 PAYMENTS_NOT_CONFIGURED (no keys) →
  invalid token 404; SLOT_UNAVAILABLE + token expiry verified via service;
  web + @repo/api typecheck/lint green. LLM-driven booking not E2E'd: free
  Gemini + OpenRouter quotas exhausted (429 free-models-per-day) — rerun
  with credits/paid key. Test rows cleaned up.

P6 Billing + email marketing + integrations
- Stripe Checkout subscription for plans (STANDARD/PRO/ULTIMATE),
  webhook-verified, per-owner (one subscription upgrades all of the
  owner's domains); credit ledger deferred — credits stay plan-derived
  from PLAN_LIMITS (incl. emailsPerMonth: 0/500/5000/50000)
- email marketing: campaigns, Resend send with per-campaign budget
  check, unsubscribe + delivery webhooks (Svix-scheme verification)
- integrations page (Stripe Connect first, extensible list)
- Done when: upgrade/downgrade + credits + campaign send verified
- Status: migration 0007 (subscriptions, campaigns, campaign_recipients,
  unsubscribed_emails) applied to Neon; @repo/api billing + email
  services (typecheck/lint green); web routes /api/billing/{checkout,
  portal}, /api/campaigns(+/[id]/send), /api/webhooks/{stripe,resend},
  /api/integrations/stripe-connect; pages dashboard/billing, campaigns,
  integrations, /unsubscribe. Verified locally w/ temp user: pages 200,
  checkout INVALID_INPUT → fixed → BILLING_NOT_CONFIGURED (no keys),
  campaign create + send 501 EMAIL_NOT_CONFIGURED, unsubscribe renders;
  web + @repo/api typecheck/lint green. Test user/rows cleaned up.
  NOT yet verified with real Stripe/Resend keys (not set): full checkout
  → webhook → plan/domain application, campaign send + delivery
  webhooks. Work uncommitted.

P7 Owner sales config: products + filter questions (capture → sell)
- Goal: close the two biggest gaps vs. divesai's original product — the
  lead-capture "filter questions" flow and a real product catalog that the
  agent sells (instead of a hardcoded test amount).
- schema (migration 0008): `products` (domain FK cascade, name, description,
  price_cents, currency default usd, active, timestamps, owner-scoped via
  domain) + `leads.answers jsonb` column for captured filter answers
- products service (services/api/products): owner-scoped CRUD (create/list/
  update/deactivate), zod-validated, plan.gateable (products.toggle on
  STANDARD+, count caps from PLAN_LIMITS)
- chat wiring: new `sell_product` tool (agent picks owner catalog product →
  creates real-amount payment request); create_payment falls back to
  catalog-aware amounts; portal /pay + booking stores productId + amount
  from the catalog, never agent-asserted
- filter questions (agents.filter_questions jsonb): agent asks at
  conversation start, answers persisted to leads.answers + surfaced in the
  dashboard conversation side panel; widget prompt flow updated so
  questions precede any hand-off
- owner UI: Products page (dashboard) list/create/edit/deactivate + embed
  money display; filter-question editor on the agent settings page
- Done when: E2E — owner creates product → chat sell_product → portal pay
  shows the real cents amount → payment_intent webhook marks paid with
  productId; a conversation with filter questions ends with lead.answers
  populated and visible in the dashboard; web + @repo/api typecheck/lint green

P7 status (done, committed + pushed):
- schema: migration 0008 (products table, leads.answers, agents.filter_questions)
  + 0009 (payments.product_id FK set null) both applied to Neon and verified
- products service: owner-scoped CRUD (no DELETE; deactivate via active flag),
  plan-gated (free→429 PLAN_LIMIT_EXCEEDED), caps 0/50/500/5000
- chat: sell_product tool (case-insensitive catalog match, quantity 1-100,
  creates payment with product_id + price_cents*qty), capture_email upserts
  lead and merges answers into leads.answers
- agents: filter_questions editor (≤20) in dashboard; tools default to full
  AGENT_TOOLS set on create (was: [] → Gemini returned empty completions,
  found during E2E); agentToolsSchema gained sell_product
- owner UI: /dashboard/products (chips, create/edit/deactivate, plan-gated
  empty state), /dashboard/agents (filter question editor), sidebar entries,
  conversations lead panel renders captured answers
- E2E verified live: agent asked filter question + quoted catalog price
  ($149.99) on turn 1; turn 2 fired capture_email AND sell_product (fixed
  Gemini multi-tool stream bug: per-index accumulators concat names →
  entryByIndex map + id rotation), lead row has email + 3 answers, payment
  row product_id/amount_minor 14999 created; payment link streamed; dashboard
  pages 200. Portal /pay page renders the real amount ($149.99) + product
  name from the token link. web + @repo/{api,ai,database} typecheck/lint
  green. P7 fixtures cleaned up from Neon.
- not testable without real Stripe keys (deferred, same as P6): checkout
  → webhook → payment marked paid with productId (PaymentButton degrades
  gracefully with PAYMENTS_NOT_CONFIGURED message).

P8 Owner analytics (conversations/leads/bookings/payments/campaigns over time)
- Goal: aggregated owner-facing insight — totals + trends across products,
  payments (revenue), leads, conversations, bookings over a selectable range.
- schema: none new — reads conversations/leads/bookings/payments/products
- analytics service (services/api/analytics): owner-scoped, zod-validated
  aggregates over a range (totals: revenueByCurrency, paidPayments,
  conversations, leads, messages; revenueSeries per day; topProducts; KPI
  series for the overview chart); exported via "@repo/api/analytics"
- API route apps/web/app/api/analytics (owner + domain-scoped) + thin web
  wrapper (services/analytics-service.ts)
- owner UI: /dashboard/analytics page (range selector 7/30/90, KPI cards,
  dependency-free div/Tailwind charts: revenue + volume over time, top
  products) + sidebar link; revenue rendered per-currency with currency symbols
- Status (done, committed + pushed): 11 commits (schemas → service → exports →
  route → charts → page → sidebar). Verified live: seeded paid product →
  totals + revenueByCurrency sum correctly across mixed currencies; dashboard
  page renders; fixtures cleaned up. Typecheck/lint green on web + @repo/api.
  Revenue display later unified via @repo/money (P9).

P9 Money config — single money library (dinero.js) with a currency
registry so amounts render consistently (GHS default).
- Goal: fix "Currency inconsistencies (GHS vs $)" from the divesai defect
  list — one money layer used everywhere, GHS default, scalable registry.
- packages/money (new): currency registry (ghs/usd/eur/gbp, DEFAULT_CURRENCY
  "ghs", CURRENCY_CODES) + dinero.js helpers (formatMoney, formatDecimal,
  currencyCode, addMoney, sumMoneyByCurrency); raw TS export via exports map
- database (migration 0010): products.currency default usd→ghs + check
  constraint IN ('ghs','usd','eur','gbp'); payments.currency normalized to
  lowercase + same constraint + default 'ghs'; schema files updated (portal.ts
  default "ghs", products.ts enum)
- api: products create/update + portal create_payment derive currency codes
  from CURRENCY_CODES, portal normalizes input (trim/lowercase) + defaults ghs
- web: products/analytics/pay pages render via formatMoney; product-actions
  edit sheet price via formatDecimal; create-product-button currency select
  from registry (GHS first); chat catalog + payment strings via
  formatDecimal/currencyCode
- Status (done, committed + pushed): 13 commits. Verified live: creating a
  product with no currency → currency "ghs"; /dashboard/products renders
  GH₵750.00; /dashboard/analytics revenue GH₵2,500.00 + revenueByCurrency
  [{ghs, minor}]; /portal/pay renders GH₵2,500.00; fixtures cleaned.
  Typecheck/lint green on money + database + api + web.

P10 Transactional email — booking confirmation + payment receipt
- Goal: notify the customer on the two moments that matter — a booking is
  confirmed, and a payment lands. Best-effort: never fail the booking/webhook
  flow if SMTP is unconfigured or delivery fails.
- templates (services/api/src/email/templates.ts): inline-styled HTML +
  text twin for bookingConfirmation (date/time/topic, domain brand bar) and
  paymentReceipt (formatted via formatMoney, description, first-8 reference);
  HTML-escapes customer-provided fields.
- email service: export sendTransactional({ to, subject, text, html }) —
  reuses the SMTP transport helper; returns { ok:false } (no throw) when
  SMTP unset or send fails.
- wiring (services/api/src/portal/server.ts): confirmBooking joins domains for
  the brand name and emails the customer after confirm; handleStripeWebhook
  emails a receipt after marking a payment paid (payment.email present).
  Injected via createPortalService({ db, sendTransactional }) from
  apps/web/services/portal-service.ts.
- Status (done): typecheck+lint green on @repo/api + web; template unit check
  (escaping, en-GB date, 12h time, GH₵ amount, reference) passed. Live SMTP
  delivery not testable here (no real SMTP creds verifiable) — same caveat as
  P6 campaign send.

P11 Credit ledger / usage metering — conversations, AI messages, emails
per month + a Usage page.
- Goal: make monthly consumption visible against plan limits (conversations,
  AI support messages, marketing emails), completing the P6 deferral note.
- service (services/api/src/usage): owner-scoped, zod-validated, aggregates
  LIVE from source tables (no ledger drift, no migration): conversations +
  messages via domains → agents → conversations/messages in [month start,
  month end); emails = sum(campaigns.sentCount + failedCount) of sent
  campaigns in month (same semantics as emailsSentThisMonth). Plan + limits
  from getPlanLimits. Exported as "@repo/api/usage".
- API route /api/usage (period param YYYY-MM, owner-guarded) + web singleton.
- owner UI: /dashboard/usage page — meter cards (used/limit + color-coded
  bars: Widget conversations × conversationsPerDay*30, AI messages ×
  creditsPerMonth, Marketing emails × emailsPerMonth) + current-plan card;
  sidebar link + route constant.
- no new gating: existing limits (conversationsPerDay at chat POST,
  emailsPerMonth in sendCampaign) already enforced; this makes consumption
  visible for owners.
- Status (done): @repo/api + web typecheck/lint green. Live E2E: seeded
  temp owner + 1 domain + 1 conversation + 2 messages → /api/usage returns
  {period 2026-08, plan free, conversations 1, messages 2, emails 0};
  /dashboard/usage renders all cards (1 / 2 / 0 + / 3,000 / 100 / 0).
  Fixtures cleaned up from Neon.

(Deferred but tracked — candidates for P12+)
- campaign scheduling + drag-and-drop HTML template editor (P6 deferred the
  Resend template editor; now SMTP-based)
- native chat SDKs (mobile/desktop) — transport-agnostic API is ready for it
- knowledge file uploads (app-owned storage, local dev / S3 or Blob in prod)
- Sentry/observability hardening (pino exists; section 7 non-negotiable)

# 7 Non-negotiables

- Zod validation on every boundary (actions + API + services)
- Ownership check before every mutation
- No module-level mutable state; sessions/customers persisted
- No secrets in NEXT_PUBLIC_*
- All URLs configurable via env, never hardcoded
- Streaming AI; no keyword-marker control flow
- Plan limits from a single service module, not scattered constants
- Observability: pino logging, Sentry wired before P3 ships
