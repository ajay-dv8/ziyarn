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
- Currency inconsistencies (GHS vs $) — single money config per tenant.

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
  webhook-verified, credits updated atomically
- email marketing: campaigns, Resend template editor, send with
  credit check + decrement, unsubscribe + delivery webhooks
- integrations page (Stripe Connect first, extensible list)
- Done when: upgrade/downgrade + credits + campaign send verified

# 7 Non-negotiables

- Zod validation on every boundary (actions + API + services)
- Ownership check before every mutation
- No module-level mutable state; sessions/customers persisted
- No secrets in NEXT_PUBLIC_*
- All URLs configurable via env, never hardcoded
- Streaming AI; no keyword-marker control flow
- Plan limits from a single service module, not scattered constants
- Observability: pino logging, Sentry wired before P3 ships
