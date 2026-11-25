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

## Ownership transfer and account deletion

- The team page lets a workspace owner transfer ownership to an admin or
  member. The target becomes owner, the previous owner becomes an admin, and
  the domain plan cache moves to the new owner's plan. The membership,
  workspace owner, and domain updates run in one data-modifying SQL statement
  because the neon-http driver has no interactive transactions.
- Better Auth's delete-user endpoint is enabled. Deletion is refused while the
  user owns a workspace or has an active, trialing, or past-due subscription.
  Owned teams are handed to the workspace owner before the user row is removed,
  because `teams.owner_id` still cascades. The settings page exposes the flow
  and shows the blocker message.
- Subscriptions are account-level, not workspace-level. The settings page
  shows an active subscription with cancel or portal access even after the user
  transfers their last workspace; the cancel and portal routes act only on the
  signed-in user's own subscription.

## Workspace-scoped unsubscribe suppression

- `unsubscribed_emails.workspace_id` is required and cascades with the
  workspace. The unique key is `(workspace_id, email)`, so the same address can
  be suppressed in one workspace and remain reachable in another.
- The customers UI and campaign recipient builder both filter by the domain's
  workspace. Manual block/unblock writes the same workspace key. Unsubscribe
  links resolve the workspace from the campaign, not from the campaign creator.
- The unsubscribe write is one data-modifying SQL statement because neon-http
  has no interactive transactions. Re-opening a link is idempotent: the
  recipient status and campaign count change once, and the suppression insert
  does nothing on conflict.
- Migration `0042_workspace_scoped_unsubscribes.sql` backfills legacy rows to
  the workspaces where the address is a customer or campaign recipient, or
  that the row's creator owns; rows with no target are dropped. The live table
  was empty when the migration was applied, so the backfill was a no-op.

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

Browser verification for workspace roles, ownership transfer, and account
deletion passed against the dev database on 2026-11-24:

```sh
E2E_DATABASE_URL="postgresql://..." pnpm test:e2e
```

The suite creates owner/admin/viewer users, two domains, conversations, teams,
and an active subscription. It asserts shared-inbox visibility, domain
filtering, viewer read-only behavior, owner-only billing, ownership transfer
with the plan handoff, the workspace-ownership deletion blocker, and team
reassignment on deletion. It deletes its fixtures at the end.

Migration `0042_workspace_scoped_unsubscribes.sql` was validated on a
temporary branch with seeded legacy rows, then applied to the `ziyarn` Neon
project on 2026-11-25. The live table had 0 rows. A second E2E spec seeds two
workspaces with the same customer email and one campaign recipient; it asserts
that a manual block in one workspace stays invisible in the other, that an
unsubscribe link suppresses only its campaign's workspace, that re-opening the
link does not double-count, and that unblocking one workspace leaves the other
suppressed. All 6 E2E tests pass on a disposable branch.
