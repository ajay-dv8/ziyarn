# Ziyarn — Security & Performance Audit

**Date:** 2026-11-14  
**Scope:** Monorepo (apps/web, apps/admin, services/api, services/ai, packages/*)  
**Status:** Reference document — work from this later  
**Related:** `AGENTS.md`, `plan/rebuild_divesai.md`, `plan/whats-next.md`, `todo/p0-remaining.md`, `todo/after-prod.md`, `todo/function-size-and-storage.md`

---

## Executive Summary

The platform is architecturally sound (P1–P13 complete): Better Auth + Drizzle/Neon, zod validation on every boundary, owner-scoped mutations, signed HMAC portal tokens, rate limiting, and security headers are in place.

**Biggest risks:** real secrets sitting on disk in `.env`, a Report-Only (unenforced) CSP, no production error tracking/alerting, a potential SSRF vector in the crawler, and bloated Vercel function traces (39–43 MB) for chat/knowledge routes.

---

## 1. Security Findings

### Critical

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| SEC-1 | Real secrets on disk in `.env` | `apps/web/.env` | Anyone with machine access gets Neon DB password, `BETTER_AUTH_SECRET`, Gemini/OpenRouter keys, Gmail SMTP password, Paystack test secret, Cloudinary secret, R2 secret key, CRON secret. If `.env` is ever committed or the machine is compromised, all services are exposed. | Rotate all secrets. Confirm `.env` is never staged (already in `.gitignore`). Use a secrets manager for local dev. |
| SEC-2 | CSP is Report-Only, not enforced | `apps/web/next.config.js:96`, `apps/admin/next.config.js:58` | `Content-Security-Policy-Report-Only` reports violations but does not block. Combined with `'unsafe-inline'` scripts/styles, XSS payloads would still execute. | After 3–7 clean report days, rename header → `Content-Security-Policy` in both `next.config.js` files. Then replace `'unsafe-inline'` with nonces via `proxy.ts`. Tracked as P0.9. |
| SEC-3 | No production error tracking / alerting | `apps/web/sentry.server.config.ts` exists; `SENTRY_AUTH_TOKEN` empty; no error boundaries; no alert rules | Production 5xx errors are invisible until a customer reports them. Pino logs exist but no alerting. Tracked as P0.2 / Priority 2. | Install `@sentry/nextjs`, set `SENTRY_AUTH_TOKEN`, add `global-error.tsx` + `dashboard/error.tsx`, upload source maps on build, configure alert rules for 5xx spikes, chat API failures, webhook failures, AI provider errors. |

### High

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| SEC-4 | Session cookie: 7-day expiry, SameSite=Lax | `apps/web/lib/auth.ts:48-51` | Long-lived session; Lax does not block all CSRF. Better Auth trusted origins help, but state-changing actions lack explicit CSRF tokens. | Consider `sameSite: "strict"` for high-risk actions (password change, billing), shorter absolute session, or CSRF double-submit tokens on mutations. |
| SEC-5 | ✅ Done — Crawl endpoint: potential SSRF | `services/api/src/knowledge/crawler.ts` | Server fetches any owner-supplied URL. `normalizeUrl` allows http/https and same-host only — did not block private IP ranges. | Fixed: `isBlockedHost()` resolves + denies private/reserved IPv4/IPv6 (RFC 1918, loopback, link-local, multicast, TEST-NET, …); enforced in `crawlWebsite` for literal IPs and in `createDefaultFetchPage` for all hostnames. 14 tests added; typecheck/lint/tests pass. |
| SEC-6 | Public booking/slot endpoints: no rate limiting | `apps/web/app/api/public/bookings/route.ts`, `booking-slots/route.ts` | Open to spam/booking abuse and slot-scraping. | Add per-IP + per-domain rate limiting (Drizzle-backed like chat). |
| SEC-7 | Embed secret is static, no rotation | `services/api/src/chat/server.ts:260-268` | If the widget embed secret leaks, anyone can chat on that domain and burn AI credits. | Allow secret regeneration in the dashboard; display secret only once on creation. |
| SEC-8 | SVG upload without sanitization | `apps/web/app/api/uploads/logo/route.ts:17-22` | SVG can contain JS/XSS if served inline to other users. | Reject SVG or sanitize (DOMPurify) before storage; serve with `Content-Disposition: attachment`. |
| SEC-9 | Knowledge file upload: no file-size limit | `services/api/src/knowledge/server.ts:249-297` | `uploadFileSchema` validates `data` as Uint8Array but caps nothing; huge file could OOM the function before chunking. | Add `MAX_UPLOAD_BYTES` zod check on `parsed.data.byteLength` (e.g. 10–25 MB). |

### Medium

| # | Issue | Location | Risk | Fix |
|---|-------|----------|------|-----|
| SEC-10 | No API key system | `todo.md:90-91` | Only session-based auth exists; no programmatic API access for customers. | Design and implement API keys (hashed, scoped, rate-limited, owner-verified). |
| SEC-11 | Error logs may leak internals | Multiple routes (`console.error`) | Stack traces/errors written to stdout/logs could include request details/secrets. | Sanitize logs; never log request bodies/headers/secrets. |
| SEC-12 | Next.js default metadata | `apps/web/app/layout.tsx:7-10` | `title: "Create Next App"` — SEO issue, not security. | Set real title/description/OpenGraph. |

### What's already done well

- zod validation on every API/action boundary
- Owner-scoped mutations (domain/agent checks in every service)
- Signed HMAC portal tokens with `timingSafeEqual`, expiry, and type checks
- Rate limiting: auth (Better Auth), chat (Drizzle sliding window per visitor/domain)
- Security headers: `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, Permissions-Policy, HSTS (production)
- `poweredByHeader: false`
- Stripe webhook uses raw body + signature verification
- Paystack webhook fixed to verify with `PAYSTACK_SECRET_KEY` (was using wrong secret before)
- Admin auth: separate better-auth instance, distinct cookie prefix, explicit schema mapping, allowlist via `requireAdmin()`

---

## 2. Performance Findings

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| PERF-1 | ✅ Done — Large function traces (39–43 MB) | `/api/chat`, `/api/knowledge/*` | Split knowledge service into read/upload/crawl so chat + read routes no longer trace the PDF/XLSX/DOCX extraction stack (~30 MB `@napi-rs/canvas`). New files: `errors.ts`, `read-server.ts`, `ingest.ts`, `upload-server.ts`, `crawl-server.ts`. Read routes import from `@repo/api/knowledge/read-server` (no heavy imports). Upload/crawl routes use the full service. Typecheck/lint/tests pass on `@repo/api` and `web`. |
| PERF-2 | SSE delta polling every 1s (up to 8s) | `services/api/src/chat/server.ts:157-160, 183-205` | Every open owner-messenger tab polls Neon every second. At scale this is many DB reads. | Increase `DELTA_INTERVAL_MS`, or switch to LISTEN/NOTIFY + short poll. |
| PERF-3 | Rate limit = DB write per message | `apps/web/lib/rate-limit-db.ts:17-31` | Atomic upsert on every chat message; write amplification under load. | Move to Redis/in-memory store with periodic flush, or batch increments. |
| PERF-4 | `listConversationsForOwner` fetches ALL messages | `services/api/src/chat/server.ts:360-426` | No pagination; slow for owners with many conversations/long histories. | Add `limit`/`offset` pagination and only fetch recent messages. |
| PERF-5 | `listDocuments` has no limit | `services/api/src/knowledge/server.ts:342-347` | Returns all documents for an agent. | Add pagination. |
| PERF-6 | No Redis / edge caching | Across | Every request hits Neon directly; no cached hot data. | Add caching for plan limits, domain config, product catalog. |
| PERF-7 | R2 configured but unused | `todo/function-size-and-storage.md` Item C | Blob is free at current scale (260 KB) but R2 env vars exist. Not a blocker yet. | Migrate to R2 only when storage/egress matters. |

---

## 3. Not Yet Implemented (from plan/todo)

### P0 — Launch Safety ($0) — `todo/p0-remaining.md`

| # | Item | Status | File refs |
|---|------|--------|-----------|
| P0-1 | Payment rail decision — Stripe Connect vs Paystack subaccounts for portal product checkout | ❌ Not decided | `plan/payments.md` not written; `apps/web/app/api/webhooks/stripe/route.ts` unused in prod |
| P0-2 | Sentry manual setup — auth token, source maps, alert rules | ❌ Code done, manual steps remain | `SENTRY_AUTH_TOKEN` empty; no `global-error.tsx`; no alerts |
| P0-3 | Admin auth manual checks — lockout after 5 failures/15 min; 30-min idle timeout | ❌ Not manually verified | `apps/admin/lib/auth.ts` has the code; needs hand-testing |
| P0-4 | CSP enforcement — flip Report-Only → enforcing after clean window | ⏳ In rehearsal | `apps/web/next.config.js`, `apps/admin/next.config.js` |
| P0-5 | Pre-live Paystack cleanup — live webhook URL, clear test subscription | ❌ Not done | `services/api/src/paystack/live.test.ts` |
| P0-6 | Live charge — deferred until fee acceptable | ⏸ Deferred | — |

### What's Next Roadmap — `plan/whats-next.md`

| Priority | Item | Effort | Blocks |
|----------|------|--------|--------|
| High | Live Stripe/Resend verification | 1 session | Production launch |
| High | Sentry integration | 30 min | Production monitoring |
| High | Documentation content (17 MDX placeholder pages) | 15–20 hrs | User self-service |
| Medium | Conversational onboarding flow (6-step wizard) | 4–6 hrs | New user activation |
| Low | Agent identity & personalization | 1–2 hrs | Nothing (TODOs in chat route) |
| Low | Native chat SDKs (React Native, Flutter, Electron) | Large | Nothing |

### Function Size & Storage — `todo/function-size-and-storage.md`

| # | Item | Status |
|---|------|--------|
| A | Split knowledge read paths from upload/crawl (reduce chat/knowledge functions below ~10 MB) | ❌ Deferred, "do now" |
| B | Remove knowledge files when domain/agent is deleted (orphaned storage objects) | ❌ Deferred |
| C | R2 adapter + migration | ❌ Deferred (Blob default until needed) |

### Todo.md

| # | Item | Status |
|---|------|--------|
| 1 | Error tracking — Sentry | ❌ Not installed/configured |
| 2 | Live Paystack verification | ❌ Not run end-to-end |
| 3 | Team polish — team switcher, default team on onboarding | ❌ Not done |
| — | API key system | ❌ Does not exist |
| — | Real documentation | ❌ Placeholder stubs |

---

## 4. Recommended Order of Work

1. **Rotate secrets** in `.env` (SEC-1) — immediately.
2. **Sentry setup** (SEC-3 / P0-2) — 30 min, unblocks production monitoring.
3. **Live Stripe/Resend verification** (P0-1 / Priority 1) — unblocks production launch.
4. **CSP enforcement** (SEC-2 / P0-4) — after clean report window.
5. **Payment rail decision** (P0-5) — decide Stripe vs Paystack for product checkout.
6. **Admin auth manual checks** (P0-3) — hand-test lockout + idle timeout.
7. **Function size split** (PERF-1) — ✅ Done (knowledge service split into read/upload/crawl; chat/knowledge read routes no longer trace the ~30 MB extraction stack).
8. **SSRF hardening** (SEC-5) — ✅ Done (private/resolved IP blocking in crawler; tests added).

---

## 5. Key Files Reference

| File | Purpose |
|------|---------|
| `apps/web/lib/auth.ts` | Customer Better Auth config |
| `apps/web/lib/auth-config.ts` | Auth rate limits, trusted origins |
| `apps/web/next.config.js` | Web CSP, security headers, Sentry config |
| `apps/admin/next.config.js` | Admin CSP, security headers |
| `apps/admin/lib/auth.ts` | Admin Better Auth config (separate instance) |
| `apps/web/app/api/chat/route.ts` | Public chat API (embed secret, rate limit, SSE) |
| `services/api/src/chat/server.ts` | Chat service (conv context, system prompt, delta stream) |
| `services/api/src/knowledge/server.ts` | Knowledge service (upload, crawl, query, owner-scoped) |
| `services/api/src/knowledge/crawler.ts` | Website crawler (SSRF surface) |
| `services/api/src/knowledge/storage.ts` | Local file storage (path traversal guard present) |
| `services/api/src/portal/server.ts` | Portal tokens, bookings, payments, Stripe webhook |
| `apps/web/app/api/uploads/logo/route.ts` | Logo upload (no SVG sanitization, 2 MB limit) |
| `apps/web/app/api/public/bookings/route.ts` | Public booking (no rate limit) |
| `apps/web/app/api/public/booking-slots/route.ts` | Public slots (no rate limit) |
| `apps/web/lib/rate-limit-db.ts` | Drizzle-backed chat rate limiter |
| `todo/p0-remaining.md` | P0 launch-safety plan |
| `plan/whats-next.md` | Post-P13 roadmap |
| `todo/function-size-and-storage.md` | Function size + storage deferred work |
