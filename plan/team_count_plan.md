# Plan 1: Rename Plans + Add Team Members

## Overview

Rename plan tiers (standard→plus, pro→business, ultimate→enterprise) and add
a team member system so multiple users can access the same domain with roles.

---

## Plan Tiers

| Old | New | Max Domains | Credits/mo | Conversations/day | Emails/mo | Max Products | Max Members |
|-----|-----|-------------|------------|-------------------|-----------|--------------|-------------|
| Free | Free | 1 | 100 | 100 | 0 | 0 | 1 |
| Standard | Plus | 3 | 1,000 | 1,000 | 500 | 100 | 3 |
| Pro | Business | 10 | 10,000 | 5,000 | 5,000 | 500 | 10 |
| Ultimate | Enterprise | 100 | 100,000 | 50,000 | 50,000 | 10,000 | Unlimited |

---

## Phase 1: Database Schema Changes

### Step 1.1 — Create `teamMembers` table

**File:** `packages/database/src/schema/index.ts`

Add new table after `users`:

```ts
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member"] })
    .notNull()
    .default("member"),
  invitedBy: text("invited_by").references(() => user.id, {
    onDelete: "set null",
  }),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("team_members_domain_user_idx").on(table.domainId, table.userId),
  index("team_members_domain_idx").on(table.domainId),
  index("team_members_user_idx").on(table.userId),
]);
```

### Step 1.2 — Generate migration

Run from `packages/database/`:
```bash
pnpm exec drizzle-kit generate
```

If it hangs, apply SQL manually via the temp API route pattern.

### Step 1.3 — Export schema

Add `teamMembers` to the schema exports in `packages/database/src/schema/index.ts`.

---

## Phase 2: Rename Plan Values

### Step 2.1 — Plan schema

**File:** `services/api/src/plans/schemas.ts`

```ts
// Before
export const planSchema = z.enum(["free", "standard", "pro", "ultimate"]);

// After
export const planSchema = z.enum(["free", "plus", "business", "enterprise"]);
```

### Step 2.2 — Plan limits

**File:** `services/api/src/plans/server.ts`

Update `PLAN_LIMITS` keys and add `maxMembers`:

```ts
export type PlanLimits = {
  maxDomains: number;
  creditsPerMonth: number;
  conversationsPerDay: number;
  emailsPerMonth: number;
  maxProductsPerDomain: number;
  maxMembers: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxDomains: 1,
    creditsPerMonth: 100,
    conversationsPerDay: 100,
    emailsPerMonth: 0,
    maxProductsPerDomain: 0,
    maxMembers: 1,
  },
  plus: {
    maxDomains: 5,
    creditsPerMonth: 1000,
    conversationsPerDay: 1000,
    emailsPerMonth: 500,
    maxProductsPerDomain: 50,
    maxMembers: 3,
  },
  business: {
    maxDomains: 20,
    creditsPerMonth: 10000,
    conversationsPerDay: 5000,
    emailsPerMonth: 5000,
    maxProductsPerDomain: 500,
    maxMembers: 10,
  },
  enterprise: {
    maxDomains: 100,
    creditsPerMonth: 100000,
    conversationsPerDay: 50000,
    emailsPerMonth: 50000,
    maxProductsPerDomain: 5000,
    maxMembers: 999,
  },
};
```

### Step 2.3 — Billing schemas

**File:** `services/api/src/billing/schemas.ts`

```ts
// Before
export const checkoutPlanSchema = z.enum(["standard", "pro", "ultimate"]);
export const billingPlanSchema = z.enum(["free", "standard", "pro", "ultimate"]);

// After
export const checkoutPlanSchema = z.enum(["plus", "business", "enterprise"]);
export const billingPlanSchema = z.enum(["free", "plus", "business", "enterprise"]);
```

### Step 2.4 — Paystack plan names and prices

**File:** `services/api/src/paystack/server.ts`

```ts
// Before
const PLAN_NAME: Record<CheckoutPlan, string> = {
  standard: "Ziyarn Standard",
  pro: "Ziyarn Pro",
  ultimate: "Ziyarn Ultimate",
};
export const PLAN_PRICES_KOBO: Record<CheckoutPlan, number> = {
  standard: 2_900_000,
  pro: 9_900_000,
  ultimate: 29_900_000,
};

// After
const PLAN_NAME: Record<CheckoutPlan, string> = {
  plus: "Ziyarn Plus",
  business: "Ziyarn Business",
  enterprise: "Ziyarn Enterprise",
};
export const PLAN_PRICES_KOBO: Record<CheckoutPlan, number> = {
  plus: 2_900_000,
  business: 9_900_000,
  enterprise: 29_900_000,
};
```

### Step 2.5 — Usage schemas

**File:** `services/api/src/usage/schemas.ts`

Update the inline limits type to include `maxMembers`.

---

## Phase 3: Update All PLAN_RANK Maps

The same `PLAN_RANK` map is duplicated across 5 files. Update all of them.

**Files:**
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/billing/page.tsx`
- `apps/web/app/dashboard/products/page.tsx`
- `apps/web/app/dashboard/campaigns/page.tsx`

```ts
// Before
const PLAN_RANK: Record<Plan, number> = {
  free: 0, standard: 1, pro: 2, ultimate: 3,
};

// After
const PLAN_RANK: Record<Plan, number> = {
  free: 0, plus: 1, business: 2, enterprise: 3,
};
```

---

## Phase 4: Update All UI Labels

### Step 4.1 — Pricing page

**File:** `apps/web/app/pricing/page.tsx`

```ts
const PLANS = [
  { plan: "free",      tagline: "Try the agent on one domain" },
  { plan: "plus",      tagline: "For small teams" },
  { plan: "business",  tagline: "For growing businesses" },
  { plan: "enterprise", tagline: "For large-scale operations" },
] as const;
```

### Step 4.2 — Billing page

**File:** `apps/web/app/dashboard/billing/page.tsx`

```ts
const PLANS = [
  { id: "plus",     name: "Plus",     blurb: "For small teams" },
  { id: "business", name: "Business", blurb: "For growing businesses" },
  { id: "enterprise", name: "Enterprise", blurb: "For large-scale operations" },
];
```

### Step 4.3 — Upgrade button labels

**File:** `apps/web/components/dashboard/upgrade-button.tsx`

Update all `label="Upgrade to Standard"` → `label="Upgrade to Plus"`, etc.

### Step 4.4 — Other UI references

Update `capitalize` plan display and hardcoded plan names in:
- `apps/web/app/dashboard/page.tsx` (line 73, 180)
- `apps/web/app/dashboard/usage/page.tsx` (line 136)
- `apps/web/app/dashboard/campaigns/page.tsx` (line 66)

---

## Phase 5: Team Management API

### Step 5.1 — Team service schemas

**New file:** `services/api/src/team/schemas.ts`

```ts
import { z } from "zod";

export const inviteMemberSchema = z.object({
  domainId: z.uuid(),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const removeMemberSchema = z.object({
  domainId: z.uuid(),
  memberId: z.uuid(),
});

export const updateRoleSchema = z.object({
  domainId: z.uuid(),
  memberId: z.uuid(),
  role: z.enum(["admin", "member"]),
});

export const acceptInviteSchema = z.object({
  token: z.string(),
});
```

### Step 5.2 — Team service

**New file:** `services/api/src/team/server.ts`

Functions:
- `listMembers(domainId, headers)` — list all members of a domain
- `inviteMember(input, headers)` — check limits, insert with invitedAt
- `removeMember(input, headers)` — remove from team (not owner)
- `updateRole(input, headers)` — change role (not owner)
- `acceptInvite(token)` — find invite, add user, set joinedAt
- `getMemberCount(domainId)` — count members for limit check

### Step 5.3 — Team API routes

**New file:** `apps/web/app/api/team/route.ts`
- `GET` — list members for domain
- `POST` — invite member (checks `maxMembers` limit)

**New file:** `apps/web/app/api/team/[memberId]/route.ts`
- `PATCH` — update role
- `DELETE` — remove member

**New file:** `apps/web/app/api/team/accept/route.ts`
- `POST` — accept invite via token

---

## Phase 6: Auto-Add Owner to Team

### Step 6.1 — Domain creation

**File:** `services/api/src/domains/server.ts`

After creating a domain, insert the owner as team member:

```ts
await db.insert(teamMembers).values({
  domainId: domain.id,
  userId: ownerId,
  role: "owner",
  joinedAt: new Date(),
});
```

### Step 6.2 — Domain deletion

Already cascades via foreign key — no change needed.

---

## Phase 7: Team Management UI

### Step 7.1 — Team settings page

**New file:** `apps/web/app/dashboard/settings/team/page.tsx`

Layout:
```
┌─────────────────────────────────────────────┐
│ Team Members                                │
│ Manage who has access to your domains.      │
│                                             │
│ [Invite Member]  2 of 3 seats used          │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Name        Email      Role    Actions  │ │
│ │─────────────────────────────────────────│ │
│ │ You         you@email  Owner   —        │ │
│ │ John        j@m.com    Admin   [⋮]      │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Step 7.2 — Components

**New:** `apps/web/components/dashboard/team/member-list.tsx`
- Table of members with name, email, role, remove button
- Owner row cannot be removed or have role changed

**New:** `apps/web/components/dashboard/team/invite-form.tsx`
- Dialog with email input and role selector
- Shows "X of Y seats used" and disables invite when at limit

**New:** `apps/web/components/dashboard/team/role-select.tsx`
- Dropdown to change member role (admin, member)

### Step 7.3 — Settings layout update

**File:** `apps/web/app/dashboard/settings/layout.tsx`

Add "Team" link to settings sidebar navigation.

---

## Phase 8: Enforce Member Limits

### Step 8.1 — Invite API

In `team/server.ts`, before inserting a new member:

```ts
const limits = getPlanLimits(domain.plan);
const currentCount = await getMemberCount(domain.id);
if (currentCount >= limits.maxMembers) {
  throw new PlanLimitError(
    429,
    "MEMBER_LIMIT_EXCEEDED",
    `Your ${domain.plan} plan allows up to ${limits.maxMembers} team members`
  );
}
```

### Step 8.2 — Chat route permission check

**File:** `apps/web/app/api/chat/route.ts`

In the owner reply path (POST with `sender: "owner"`), verify the sender is a team member with admin or owner role.

---

## Phase 9: Verification

1. Typecheck all packages: `pnpm --filter @repo/api check-types && pnpm --filter web check-types`
2. Lint: `pnpm --filter @repo/api lint && pnpm --filter web lint`
3. Test: create a domain → verify owner is auto-added to team
4. Test: invite a member → verify limit enforcement
5. Test: upgrade plan → verify member limit updates
6. Test: remove member → verify removal
7. Test: all plan labels display correctly across dashboard

---

## File Checklist

### New files (9)
- `packages/database/drizzle/0024_team_members.sql`
- `services/api/src/team/schemas.ts`
- `services/api/src/team/server.ts`
- `services/api/src/team/index.ts`
- `apps/web/app/api/team/route.ts`
- `apps/web/app/api/team/[memberId]/route.ts`
- `apps/web/app/api/team/accept/route.ts`
- `apps/web/app/dashboard/settings/team/page.tsx`
- `apps/web/components/dashboard/team/member-list.tsx`
- `apps/web/components/dashboard/team/invite-form.tsx`
- `apps/web/components/dashboard/team/role-select.tsx`

### Modified files (20+)
- `packages/database/src/schema/index.ts`
- `services/api/src/plans/schemas.ts`
- `services/api/src/plans/server.ts`
- `services/api/src/plans/index.ts`
- `services/api/src/billing/schemas.ts`
- `services/api/src/paystack/server.ts`
- `services/api/src/usage/schemas.ts`
- `services/api/src/domains/server.ts`
- `apps/web/app/pricing/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/dashboard/layout.tsx`
- `apps/web/app/dashboard/billing/page.tsx`
- `apps/web/app/dashboard/products/page.tsx`
- `apps/web/app/dashboard/campaigns/page.tsx`
- `apps/web/app/dashboard/usage/page.tsx`
- `apps/web/app/dashboard/settings/layout.tsx`
- `apps/web/components/dashboard/upgrade-button.tsx`
- `apps/web/app/api/chat/route.ts`
