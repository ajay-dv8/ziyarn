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
  ready, full snippet UI ships with the P3 widget)
- Done when: domain CRUD verified owner-only via curl + UI (done)

P3 Agent pipeline (the core)
- agents CRUD + agent config service (done: services/api/agents, owner-scoped)
- chat API route (public): domain secret + rate limit (done: /api/chat POST+GET,
  x-embed-secret, in-memory sliding window per visitor, SSE streaming, 401/403/
  404/429/503 error codes; E2E verified 14/14)
- services/ai: openai chat completions, tool calling (capture_email,
  book_appointment, create_payment, escalate, answer_knowledge), streaming
  (done: @repo/ai streamChat generator, tool loop up to 5 rounds; pending live
  OpenAI key verification)
- messages persisted + context windowing (done: conversations/messages, status
  active/escalated/resolved/closed, visitor_id, 20-message context window)
- knowledge base upload -> embeddings (pgvector or neon vector) + retrieval
  (done: P3b — embeddings.embedding vector(1536) + HNSW cosine index
  (0004_knowledge_embeddings), services/ai embed() (text-embedding-3-small),
  services/api knowledge service (upload/list/delete/query, owner-scoped,
  chunker 900 chars/120 overlap, `1 - (embedding <=> q)::vector` cosine
  search), chat answer_knowledge tool wired to retrieval; E2E 13/13 +
  pgvector verified on Neon; pending live OpenAI key for real embeddings)
- widget: decision = Shadow DOM web component (NOT iframe) — works in WebViews
  of mobile/desktop apps, not just browsers; chat API stays transport-agnostic
  (REST + SSE) so native SDKs can call it directly (pending: P3c, after user
  sign-off)
- Done when: widget holds a full sales + helpdesk conversation,
  escalates, persists, and streaming renders

P4 Realtime escalation + owner messenger
- decision: private Pusher channels with auth endpoint vs SSE
- dashboard conversations page (list, unread, messenger)
- realtime toggle from agent tool call, owner reply
- Done when: owner replies stream to widget in realtime

P5 Customer portal
- signed portal URLs (token in query, expires)
- appointment booking flow (questions -> calendar -> slots -> confirm)
- product checkout (Stripe PaymentElement on connected account) + webhook
  to confirm payment, create leads + bookings atomically
- Done when: full booking + payment path verified end-to-end

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
