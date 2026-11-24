# Workspace-scoped integrations

## Goal

A business connection belongs to the workspace, not to the user who happened to
click Connect. Every member of the workspace sees the same Stripe account and
AI provider; a user in two workspaces can connect a different account to each.

## What changed

- `stripe_accounts.workspace_id` is required and unique. Stripe Connect reads,
  creates, and pays out through the active workspace.
- `ai_configs.workspace_id` is required and unique. The workspace row is the
  default provider; `domain_ai_configs` is still the per-domain override.
- `owner_id` stays on both tables as “who connected it”. It is nullable and
  `on delete set null`, so deleting that user does not delete shared
  workspace data. It is not an access grant.
- Stripe connect is owner/admin only. AI settings can be read by any member;
  viewers cannot change them. Domain overrides require membership in the
  domain's workspace.
- Chat and embeddings resolve the provider from the domain's workspace, so a
  widget always uses its own workspace's key.

## Migration

`packages/database/drizzle/0040_workspace_integrations.sql` is idempotent and
applied manually, matching 0038-0039 because the drizzle journal is stale.

- Adds the columns and backfills each row into the connector's first-joined
  workspace (the same rule domains and campaigns use).
- Creates a workspace for legacy users who have an integration but no
  membership.
- If two members connected the same workspace before the migration, keeps the
  complete/newest Stripe row and the newest AI row.
- Drops the owner-unique indexes and adds workspace-unique indexes.

Apply with:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/drizzle/0040_workspace_integrations.sql
```

## Out of scope

- Email delivery is still a deployment-level `SMTP_HOST` / `SMTP_FROM` setting,
  not an owner-keyed row. Making it per-workspace needs a settings table and
  secret storage.
- `subscriptions` is still user-keyed. A subscription covers every workspace
  the subscriber owns, and workspace limits come from the workspace owner's
  active subscription. Workspace-owned subscriptions are a separate change.
- `data_sources` is already agent/domain-scoped.

## Verification

Typecheck, lint, API tests, web tests, and the web build pass. Migration 0040
was applied to the `ziyarn` Neon project on 2026-11-20 in one transaction (the
database had 0 Stripe and 0 AI config rows at the time, so backfill/dedupe was a
no-op). Browser verification of Stripe onboarding and AI settings with two
workspaces is pending.

Migration `0041_workspace_billing_and_owner_audit.sql` was validated on a
temporary branch and applied to the `ziyarn` Neon project on 2026-11-24. The
live database now has 4 free, 1 standard, and 2 ultimate domains (one stale
`pro` cache entry returned to free); creator FKs are `ON DELETE SET NULL` and
`workspaces.owner_id` is `ON DELETE RESTRICT`.

Browser verification for workspace roles passed against the dev database. It
uses a disposable database branch:

```sh
E2E_DATABASE_URL="postgresql://..." pnpm test:e2e
```

The suite creates owner/admin/viewer users, two domains, conversations, and an
active subscription; it asserts shared-inbox visibility, domain filtering,
viewer read-only behavior, and owner-only billing. It deletes its fixtures at
the end.
