# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: business owners who want an AI agent on their website. They manage
domains, agents, and knowledge bases from a dashboard; they are not designers
and often run small teams, so setup must be fast and the dashboard must make
the agent's behavior legible.

Secondary: the owners' website visitors, who converse with the embedded widget.
They may ask support questions or be ready to buy. Their experience inherits
the owner-facing design language.

## Product Purpose

Ziyarn lets a business embed one AI agent on its site that does both jobs at
once — answers support questions from a knowledge base (helpdesk) and runs a
sales conversation that captures leads and moves visitors toward booking or
payment — then hands off to a real human in realtime when out of scope.
Success means the owner resolves more conversations without growing headcount
and never loses a ready buyer.

## Positioning

One agent, both jobs. A single embeddable agent that both answers and sells —
then hands the visitor to a human in realtime. Competitors sell either a
support bot or a sales funnel; Ziyarn's claim is the same agent doing both,
with the human handoff built in.

## Operating Context

- Owners configure per-domain agents: name, system prompt, instructions,
  enabled tools, and knowledge sources; plan limits (STANDARD / PRO /
  ULTIMATE) gate widget conversation volume.
- Knowledge base documents are chunked, embedded, and retrieved with
  pgvector; the chat tool calls `answer_knowledge` during conversations.
- Agent tool calls capture emails (leads), book appointments, create payment
  links, escalate to a human, and answer from the knowledge base.
- The widget is embedded by secret-gated script/snippet on customer sites and
  streams replies over SSE; API is transport-agnostic for native SDKs.

## Capabilities and Constraints

- Multi-tenant by domain, owner-scoped mutations, public chat gated by domain
  embed secret + per-visitor rate limiting.
- AI stack is provider-agnostic: Gemini chat + embeddings, OpenRouter
  fallback; no OpenAI key required. Matryoshka-truncated embeddings
  (1536-dim) on a fixed vector schema.
- Booking, payment, and email marketing are planned but not shipped; the
  agent currently tells visitors a human will follow up.
- Realtime human escalation (owner messenger) is the next milestone (P4).
- No module-level mutable state; every service boundary zod-validated.

## Brand Commitments

- Product and interfaces say "agents", not "chatbots" — an AI agent platform
  for helpdesk and sales.
- Voice is clean, modern, professional: precise, confident, no hype. Fits
  the B2B dashboard context.
- Name: Ziyarn.

## Evidence on Hand

- Roadmap and product history: plan/rebuild_divesai.md (divesai rebuild).
- Working implementation: domains/agents/knowledge base + public chat API
  verified end-to-end (signup -> domain -> agent -> KB upload -> embedding ->
  retrieval -> SSE chat with tool calling).
- Landing page copy at apps/web/app/page.tsx ("AI agents for helpdesk and
  sales"); auth copy ("Welcome back to Ziyarn").
- No published pricing page, testimonials, case studies, or press yet —
  future work must not fabricate these.

## Product Principles

1. The owner is the customer. Every surface serves the business owner first;
   visitor-facing surfaces inherit the same system.
2. One agent, both jobs. Helpdesk and sales live in one agent, one embed, one
   conversation.
3. Human handoff is a feature, not a failure. Realtime escalation to the
   owner is a first-class outcome.
4. Truthful by default. Never invent company facts, pricing, or capabilities;
   the agent answers from the owner's knowledge base or escalates.
5. Gate every boundary. Secret-gated public endpoints, owner-scoped
   mutations, rate limits, validated inputs — trust is the product.

## Accessibility & Inclusion

No product-specific standard was established beyond standard web practice;
the widget runs inside third-party pages and must not break their layout or
keyboard/screen-reader flow.
