# Admin Roles & Permissions Plan

Give the Ziyarn admin panel real division of duty: who can do what, who can see
what, and a permanent record of who touched what.

Extends `plan/rebuild_divesai.md` as **R1–R7**. Builds on the admin app restored
in `apps/admin` (Next.js 16, port 3001).

---

# 1 Where the admin app stands today

Verified by reading the code, not assumed:

| Fact | Detail |
|---|---|
| **100% read-only** | `grep` for `.insert(/.update(/.delete(` across `app/`, `lib/`, `services/` returns **nothing** |
| **9 cross-tenant service functions** | `getPlatformStats`, `listUsers`, `getUserDetail`, `listDomains`, `getDomainDetail`, `listWorkspaces`, `listConversations`, `getRevenueStats`, `listAdmins` |
| **`role` is NOT enforced** | `requireAdmin()` returns it, `layout.tsx:45` renders it as a badge — and **no page or service checks it**. `viewer` ≡ `admin` ≡ `superadmin` today |
| **`listAdmins()` has no UI** | Nothing calls it |
| **No audit trail** | No table, no log, no record of who viewed what |
| **No admin self-service** | Admins can only be created via `scripts/create-admin.ts` on a machine with DB access |
| **No sign-in rate limit** | `apps/admin/app/sign-in` has no lockout |
| **No MFA** | `lib/auth.ts` has `emailAndPassword` only |
| **7-day sessions** | `expiresIn: 60 * 60 * 24 * 7`, no idle timeout |
| **`admins.password`** | Legacy plaintext `NOT NULL` column, never read by better-auth |
| **Auth resolves to customer tables** | `drizzleAdapter(db)` with no schema mapping → default `user`/`session`/`account`. Mitigated by the `admins` allowlist gate, not fixed |
| **Platform scale** | 13 users · 3 domains · 3 agents · 2 conversations · 14 messages · 18 customers · 0 payments · **0 admins** |

**The allowlist gate already works** (verified live: a signed-up customer is
redirected off `/admin`). This plan is about what happens *after* someone is on
that list.

---

# 2 The two axes

Most admin RBAC plans conflate these and end up unmaintainable. Ziyarn needs
both, kept separate:

**Axis 1 — Privilege** (what an admin may *do*) → §4 permission matrix
**Axis 2 — Sensitivity** (what an admin may *see*) → §5 data tiers

A "reporter" who needs revenue charts but must never read customer messages is
**not** expressible as a single role ladder. It is `analyst` privilege + Tier-0
data cap. Keeping the axes separate is what makes that combination possible.

---

# 3 Roles

Four roles. Sized for a small team; the permission map makes adding a fifth a
data change, not a refactor.

| Role | Who | Summary |
|---|---|---|
| `owner` | 1–2 people, founders | Platform-wide control. The only role that can manage admins, impersonate, refund, or read the audit log. |
| `admin` | Operations staff | Tenant operations: change plans, suspend domains, read PII and conversation content. Cannot manage admins or impersonate. |
| `support` | Customer-facing staff | Look up a user/domain, read and reply to conversations, manage knowledge docs. Cannot see revenue, cannot change plans. |
| `analyst` | Reporting / reviews | Aggregate metrics and revenue. **No PII, no conversation content, no message bodies.** This is the "check and report" role. |

### Why `owner` and not `superadmin`

Keeps the vocabulary consistent with `ownerId` / `domains.ownerId` /
`workspaces.ownerId`, which already mean "the person who owns this tenant"
throughout the codebase. A platform-level `owner` reads naturally next to those.

### Why four, not seven

At 13 users and 3 domains, a seven-role matrix is speculative and will be
wrong. If support staff later need a billing-only variant, that is a new row in
`PERMISSIONS`, not a new role enum — see §4.

---

# 4 Permission model

## 4.1 The rule

**No `if (role === "...")` checks in pages.** Permission checks live in exactly
one module, and pages ask for a permission, never for a role.

This mirrors the repo's existing single-source-of-truth pattern:
`PLAN_LIMITS` in `services/api/src/plans/server.ts` is read by every service and
never re-declared. `PERMISSIONS` is the same idea for staff authority.

## 4.2 New file: `apps/admin/lib/permissions.ts`

Pure TS, no I/O, no DB — trivially unit-testable.

```ts
export const PERMISSIONS = [
  // ---- read: platform aggregates ----
  "platform.stats.read",
  "revenue.read",

  // ---- read: tenants ----
  "tenant.user.read",
  "tenant.domain.read",
  "tenant.workspace.read",
  "tenant.conversation.read",

  // ---- sensitive reads (gated by tier, see §5) ----
  "pii.read",
  "content.read",

  // ---- write: tenants ----
  "tenant.plan.write",
  "tenant.suspend.write",
  "tenant.refund.write",
  "tenant.domain.delete",

  // ---- write: conversations (acting as the owner) ----
  "conversation.reply",
  "conversation.status.write",

  // ---- admin personnel ----
  "admin.list",
  "admin.invite",
  "admin.role.write",
  "admin.deactivate",

  // ---- dangerous ----
  "admin.impersonate",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [ /* everything except admin.* and admin.impersonate */ ],
  support: [
    "platform.stats.read",
    "tenant.user.read", "tenant.domain.read",
    "tenant.conversation.read",
    "pii.read", "content.read",
    "conversation.reply", "conversation.status.write",
  ],
  analyst: ["platform.stats.read", "revenue.read"],
};

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
```

## 4.3 Enforcement helpers: `lib/admin-auth.ts`

Extend the file that already exists rather than adding a parallel one.

```ts
/** Throws/redirects unless the signed-in admin holds `permission`. */
export async function requirePermission(
  permission: Permission,
  returnTo?: string,
): Promise<AdminIdentity>;

/** Non-throwing check, for hiding UI an admin cannot use. */
export function adminCan(identity: AdminIdentity, permission: Permission): boolean;
```

### Two rules for using them

1. **`requirePermission` on every page and every mutation.** Hiding a button is
   UX, not security — the check must be at the boundary.
2. **`adminCan` only ever *disables* UI, never replaces `requirePermission`.**

---

# 5 Data sensitivity tiers

The part that protects customers when a staff account is compromised.

```ts
export const DATA_TIERS = ["aggregate", "metadata", "pii", "content"] as const;
export type DataTier = (typeof DATA_TIERS)[number];

/** Highest tier each role may read. */
export const ROLE_MAX_TIER: Record<AdminRole, DataTier> = {
  owner: "content",
  admin: "content",
  support: "content",
  analyst: "metadata",   // aggregates + non-identifying metadata only
};
```

| Tier | Examples | Who |
|---|---|---|
| `aggregate` | user counts, revenue sums, per-day series, top products | all |
| `metadata` | domain names/slugs/plans, agent names, conversation titles, `visitorId.slice(0,8)`, timestamps | all |
| `pii` | emails, full names, phone, addresses | owner, admin, support |
| `content` | message bodies, knowledge document text, lead answers, customer contact lists | owner, admin, support |

## 5.1 What this changes today

| Surface | Today | After |
|---|---|---|
| `/admin` overview | counts + revenue | unchanged |
| `/admin/revenue` | revenue by day / plan | **owner/admin/analyst only** — `support` must not see revenue |
| `/admin/users` | email, name, domain count, plan | email/name masked for `analyst` |
| `/admin/users/[userId]` | full user row | **gated `pii.read`** |
| `/admin/domains` | name, slug, plan, owner email | owner email masked for `analyst` |
| `/admin/conversations` | title, agent, domain, `visitorId.slice(0,8)` | unchanged for `analyst` |

## 5.2 Masking is enforced in the service layer

Tier checks belong in `services/admin-service.ts`, not in JSX — a masked value
must never reach the browser at all:

```ts
export async function listUsers(input: {
  page?: number; search?: string; pageSize?: number;
  maxTier: DataTier;          // ← injected by the caller
}): Promise<{ users: UserRow[]; total: number; page: number; pageSize: number }>;
```

When `maxTier` is below `pii`, the projection selects `null` for email/name
rather than masking a fetched string. Fetching then hiding is not masking.

---

# 6 Audit log

**Non-negotiable.** An admin panel with cross-tenant PII and content access is
inherently high-trust; without a trail you cannot answer "who read this
customer's messages?" after an incident.

## 6.1 Table

New: `packages/database/drizzle/0028_admin_audit_log.sql`

```sql
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      text REFERENCES admins(id) ON DELETE SET NULL,
  admin_email   text NOT NULL,          -- denormalised: survives admin deletion
  action        text NOT NULL,          -- e.g. 'conversation.read', 'tenant.plan.write'
  resource_type text NOT NULL,          -- e.g. 'conversation', 'domain'
  resource_id   text,
  metadata      jsonb,                  -- never raw content
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx    ON admin_audit_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_resource_idx ON admin_audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx   ON admin_audit_log (action, created_at DESC);
```

`admin_email` is denormalised on purpose: revoking an admin must not erase what
they did.

**Not exposed via the app's own `db` write paths for deletion.** No service
function deletes from this table. Not even `owner`. Retention is a scheduled
prune (`admin.audit.read` to export first), documented in R3.

## 6.2 Schema files

- `packages/database/src/schema/admins.ts` — add `adminAuditLog`
- `packages/database/src/schema/index.ts` — re-export

⚠️ **Journal caveat:** `_journal.json` is already inconsistent (see
`rebuild_divesai.md` §13 in `voice-plan.md`). Hand-write the SQL, apply to
Neon, update the schema file.

## 6.3 Service: `apps/admin/services/audit-service.ts`

```ts
export async function recordAudit(entry: {
  admin: AdminIdentity;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;   // counts/ids only — never content
  headers?: Headers;
}): Promise<void>;

/** Best-effort: audit failures must never break the action being audited. */
export async function listAuditLogs(input: {
  page?: number; action?: string; adminId?: string; resourceType?: string;
}): Promise<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>;
```

Wrap `recordAudit` in its own try/catch at every call site and log failures with
pino. A failed audit write must not roll back a legitimate admin action — but it
must be loud.

## 6.4 What to audit

| Event | Why |
|---|---|
| `auth.signin` / `auth.signout` / `auth.failed` | Brute-force detection (§9) |
| `conversation.read` | Message content is customer PII |
| `user.read` / `domain.read` detail | Identifiable records |
| `*.list` at tier ≥ `pii` | Bulk PII extraction is the real risk |
| every `*.write` | Who changed what |
| `admin.invite` / `admin.role.write` / `admin.deactivate` | Privilege escalation |
| `admin.impersonate` | Highest-severity event on the platform |

Read the `ip_address` / `user_agent` from the request `headers` — a compromised
account is identified by where it signs in from.

---

# 7 R1–R7

Each phase ends verified: `check-types` + `lint` green on `admin`, feature
exercised against the running dev server.

## R1 — Permission model (no behaviour change)

- [ ] `lib/permissions.ts` — `PERMISSIONS`, `ROLE_PERMISSIONS`, `can()`
- [ ] `DataTier` + `ROLE_MAX_TIER`
- [ ] `requirePermission()` + `adminCan()` in `lib/admin-auth.ts`
- [ ] Unit tests: every role × every permission, and every role × every tier
- [ ] **Ship condition:** nothing calls `requirePermission` yet. Roles still
      behave identically. This phase only makes the model real and tested.

## R2 — Enforce reads

- [ ] `AdminRole` widened to `owner | admin | support | analyst` in
      `lib/admin-auth.ts` + `admins.role` enum
- [ ] `requirePermission()` on every page:
      `/admin` (stats), `/admin/revenue` (revenue), `/admin/users`
      (tenant.user.read), `/admin/users/[userId]` (pii.read),
      `/admin/domains`, `/admin/domains/[domainId]`, `/admin/workspaces`,
      `/admin/conversations`
- [ ] `maxTier` threaded into all 9 `admin-service.ts` functions
- [ ] Tier-based projection (select `null`, never mask after fetch — §5.2)
- [ ] Sidebar filters nav items by `adminCan`
- [ ] `/admin/revenue` returns 403 for `support` (not just a hidden link)
- [ ] `admin/session-expired` page explaining insufficient role
- [ ] **Ship condition:** sign in as each of the 4 roles; confirm a `support`
      account cannot load `/admin/revenue` by typing the URL.

## R3 — Audit log

- [ ] Migration `0028_admin_audit_log.sql` + `adminAuditLog` schema
- [ ] `services/audit-service.ts`
- [ ] Instrument all pages and reads; `recordAudit` fire-and-forget with
      try/catch
- [ ] `/admin/audit` page (owner only, `audit.read`) — filter by
      admin/action/resource/date
- [ ] Export CSV (also `audit.read`)
- [ ] Retention job: prune > 180 days, documented
- [ ] **Ship condition:** every `admin/*` page view produces a row with admin
      email, ip and user agent.

## R4 — Admin user management

- [ ] `admin.list` → `/admin/team` page (renders the orphaned `listAdmins()`)
- [ ] `admin.invite` — create an `admins` row; **invite by email, never set a
      password from the UI**
- [ ] `admin.role.write` — change role, with a **self-demotion guard**
      (an `owner` cannot remove their own `owner` role — lockout)
- [ ] `admin.deactivate` — soft delete (`deleted_at`), revoke sessions
- [ ] Enforce **at least one active `owner`** — refuse the last demotion
- [ ] Session revocation: delete that admin's rows from `session` on
      deactivate/role change
- [ ] Deactivating yourself is blocked
- [ ] **Ship condition:** promote a test admin, verify they gain access, then
      demote and verify access is revoked **on their next request**.

## R5 — Tenant mutations

Today admin cannot do anything. These are the operations that make it useful.
Every one: permission-gated **and** audited.

| Action | Permission | Notes |
|---|---|---|
| Change a domain's plan | `tenant.plan.write` | Manual comp / upgrade. Logged with previous + new plan. |
| Suspend / unsuspend a domain | `tenant.suspend.write` | Sets a flag checked in `apps/web` chat pipeline. Blocks widget traffic. |
| Reply to a conversation | `conversation.reply` | Inserts with `sender: "owner"`. The visitor sees a real owner bubble. |
| Set conversation status | `conversation.status.write` | resolve / close / reopen |
| Refund a payment | `tenant.refund.write` | **owner only.** Calls Stripe/Paystack refund. Money moves — always audited. |
| Delete a domain | `tenant.domain.delete` | **owner only.** Cascade is destructive; require a typed confirmation of the slug. |

All mutations go through server actions with **zod validation** and a
**confirm step**, per `AGENTS.md` ("zod validation on every boundary").

⚠️ **Never let admin write directly to the customer `db` connection for
payments.** Route refunds through `@repo/api/billing` / `@repo/api/paystack` so
webhooks and ledgers stay consistent.

## R6 — Hardening

- [ ] **Sign-in rate limit**: reuse `SlidingWindowRateLimiter` from
      `apps/web/lib/rate-limit.ts`; key `admin:${email} + ip`. 5 attempts /
      15 min. Audit `auth.failed`.
- [ ] **MFA for `owner` + `admin`** — Better Auth `twoFactor` plugin with TOTP.
      Forced at `requirePermission` level: a `owner` without a verified second
      factor cannot pass.
- [ ] **Session policy**: shorten to 8 h, add 30 min idle timeout, and require
      re-authentication for `tenant.refund.write` / `admin.role.write` /
      `admin.impersonate` (step-up auth).
- [ ] **Last-seen + active sessions** per admin (`/admin/team`); lets you spot a
      compromised account.
- [ ] **Security headers / CSP** on the admin app (`next.config.js`):
      `frame-ancestors 'none'`, `X-Frame-Options: DENY`, strict `script-src`.
      The admin panel must never be iframe-embeddable.
- [ ] **Drop `admins.password`** — legacy plaintext `NOT NULL` column, never
      read. Migration: make nullable, backfill sentinel, drop. Better Auth
      stores the hash in `account`.
- [ ] **Unauthenticated `/admin/*` returns 404, not 307-to-login**, for paths
      that reveal existence. (Optional, low value — decide explicitly.)

## R7 — Dedicated admin auth tables

The last structural weakness. Today the admin better-auth instance resolves to
the **customer** `user`/`session`/`account` tables; the `admins` allowlist is
what stops a customer reading the panel. Once admins can **write** (R5), that
coupling stops being acceptable — a bug in session handling becomes a tenant
data breach.

- [ ] New tables: `admin_sessions`, `admin_accounts`, `admin_verifications`
- [ ] `admins` gains an `image` column so it can serve as better-auth's `user`
- [ ] `drizzleAdapter(db, { schema: { user: admins, session: adminSessions, account: adminAccounts, verification: adminVerifications } })`
- [ ] Rename `admins.password` → dropped (R6)
- [ ] Verify an admin session cookie is rejected by `apps/web` and vice versa
- [ ] **Ship condition:** zero shared tables between the two auth systems.

> Do **not** start R7 before R5. Today the blast radius of a session bug is
> "read data you shouldn't". After R5 it is "change plans, reply as a customer,
> move money".

---

# 8 Migration & rollout

## 8.1 Schema

`admins.role` is `text` with a drizzle enum and **no DB-level CHECK**. Widening
to four values needs a migration that adds the constraint:

```sql
-- 0028 or later
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD  CONSTRAINT admins_role_check
  CHECK (role IN ('owner','admin','support','analyst'));
```

Drop and recreate rather than alter — Postgres cannot widen an existing CHECK.

## 8.2 Backfill

**The `admins` table is currently empty (0 rows).** There is no backfill risk
and no legacy role to preserve — this is the cheapest possible moment to make
this change. Do it before the first admin is created in production.

When you do create them:

1. **Grant `owner` first, via CLI** — `pnpm --filter admin create-admin <you> owner`
2. Then invite the rest **through `/admin/team`** with the correct role.
3. Never ship a default role. Least privilege at creation, promote explicitly.

## 8.3 Enforcement order (least disruption)

`allowlist → tier → permission → audit`

Ship R1–R2 with **no new roles granted to anyone but yourself**. You keep
`owner` (full access) so nothing breaks for you; every other person is
provisioned through the new UI with a role that fits. Roll forward, never
back-roll a permission bug.

## 8.4 Announce before R5 lands

R5 introduces writes. Staff who currently expect a read-only panel will meet
buttons they can press that change customer state. Say so, and make sure every
one of those buttons carries an audit row from day one.

---

# 9 Threat model — what each phase actually buys

| Threat | Blocked by |
|---|---|
| Customer signs into `/admin` | **Already done** — `admins` allowlist gate |
| Compromised `support` account reads revenue | R2 (`revenue.read`) |
| Staff bulk-exports customer emails | R2 tier cap + R3 audit rows |
| Insider reads a customer's private messages | R3 `conversation.read` audit |
| Compromised admin refunds themselves | R5 (`owner`-only) + R3 audit + R6 step-up |
| Compromised admin grants themselves `owner` | R4 last-owner guard + audit + step-up auth |
| Admin lockout (everyone demoted/deactivated) | R4 self-demotion guard + one-owner invariant |
| Brute force on admin sign-in | R6 rate limit |
| Stolen admin session replayed for a week | R6 8 h expiry + 30 min idle + revoke |
| Session bug leaks tenant data to a customer | R7 dedicated tables |
| Admin panel framed by an attacker's site | R6 CSP `frame-ancestors 'none'` |

---

# 10 File checklist

## New files

```
packages/database/drizzle/0028_admin_audit_log.sql
apps/admin/lib/permissions.ts
apps/admin/lib/permissions.test.ts
apps/admin/services/audit-service.ts
apps/admin/app/admin/team/page.tsx
apps/admin/app/admin/audit/page.tsx
apps/admin/app/admin/forbidden/page.tsx
apps/admin/lib/actions/admins.ts          (R4 — server actions)
apps/admin/lib/actions/tenants.ts         (R5 — server actions)
```

## Modified

```
packages/database/src/schema/admins.ts    + adminAuditLog, role enum, image, deletedAt
packages/database/src/schema/index.ts     re-export
apps/admin/lib/admin-auth.ts             + role widening, requirePermission, adminCan
apps/admin/lib/auth.ts                   + 2FA plugin, shorter session, idle timeout
apps/admin/services/admin-service.ts     + maxTier on all 9 fns, tiered projection
apps/admin/app/admin/layout.tsx          nav filtered by adminCan, last-seen
apps/admin/app/admin/*/page.tsx          requirePermission per page
apps/admin/components.json               (unchanged — admin does not use @repo/ui)
apps/admin/next.config.js                + security headers / CSP
turbo.json                               + any new env vars
```

## New env

```
ADMIN_MFA_ENFORCED_ROLES=owner,admin     R6
ADMIN_SESSION_HOURS=8                    R6
ADMIN_AUDIT_RETENTION_DAYS=180           R3
```

---

# 11 Verification

Per repo convention: `check-types` + `lint` green on `admin`, then exercise
against the running dev server.

```bash
pnpm --filter admin check-types
pnpm --filter admin lint
pnpm --filter admin build            # ← R1 caught a prerender bug; always run this
```

**Role matrix E2E.** Create four throwaway admins, one per role, then assert the
matrix. Every cell must match §4 — including by **typing the URL**, not just by
following links:

| | owner | admin | support | analyst |
|---|---|---|---|---|
| `/admin/revenue` | 200 | 200 | **403** | 200 |
| `/admin/users/[id]` | 200 | 200 | 200 | **403** |
| `/admin/team` | 200 | **403** | **403** | **403** |
| `/admin/audit` | 200 | **403** | **403** | **403** |
| Emails visible in `/admin/users` | yes | yes | yes | **masked** |
| `admin.impersonate` | yes | **403** | **403** | **403** |

**Audit E2E.** Load each page as each role → assert one row per view with the
right `admin_email`, `ip_address`, `user_agent`.

**Re-check the existing security property** — it must survive every phase:

```bash
# Sign up a throwaway customer via the admin auth endpoint, then:
curl -b cookies.txt -o /dev/null -w '%{http_code}\n' http://localhost:3001/admin
# must be 307 → /sign-in
```

**Clean up fixtures** from Neon after every live run, consistent with existing
E2E practice.

---

# 12 Open questions

1. **Does anyone outside the founding team need `owner`?** If yes, two-person
   rule: no single person can be the only `owner` for a given action.
2. **Should `analyst` see domain names?** Currently Tier `metadata` includes
   them. A domain name plus a signup date is often enough to identify a small
   business. Consider capping `analyst` at `aggregate` and dropping domain names
   from their view.
3. **Retention for `conversation.read` audits vs GDPR-style erasure.** If an EU
   customer asks for data deletion, do you delete the audit rows that reference
   their conversation, or keep them for security? **Recommend: keep
   `resource_id`, delete free-text metadata.**
4. **Impersonation — build it, or refuse it forever?** R5 lists it as
   `owner`-only. It is genuinely useful for debugging a customer's widget, and
   genuinely dangerous. If you build it: time-boxed (30 min), banner in both
   apps, audited, never able to change billing or admin settings.
5. **Should `support` be able to impersonate?** "I am on your website right now
   and I see this" is most of what support does. **Recommend: no impersonation,
   but a read-only "customer view" at `conversation.read` scope instead.**
6. **When does the `owner` role become "the founder's solo mode"?** If the team
   is one person for the next year, `owner` is ceremony — but R4's last-owner
   invariant still protects against lockout, so build it anyway.