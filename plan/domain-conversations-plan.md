# Domain-scoped conversations

## Goal

A customer with two or more domains should be able to see one domain's
conversations without the list blending every domain. The fix stays small:
no new route, no schema migration, and no change to the chat runtime.

## Chosen approach

Use the same `?domainId=` convention as the rest of the dashboard:

| URL                                                          | View                             |
| ------------------------------------------------------------ | -------------------------------- |
| `/dashboard/conversations`                                   | All domains, explicitly labelled |
| `/dashboard/conversations?domainId=<id>`                     | One domain                       |
| `/dashboard/conversations?domainId=<id>&conversationId=<id>` | One domain, chat open            |

Why this shape:

- The data is already domain-rooted: `conversations.agentId -> agents.domainId`.
- The existing query already joins through `agents` to `domains`; it only needs
  one optional predicate.
- A new route would duplicate layout and break existing links.
- A `conversations.domainId` column would duplicate the agent relationship and
  need a migration.
- An explicit "All domains" view avoids silently hiding another domain's
  escalations, which is worse than a labelled combined inbox.

## Implementation

1. **Service** (`services/api/src/chat/server.ts`)
   - Add optional `{ domainId, limit }` options to
     `listConversationsForWorkspace`.
   - Append `eq(domains.id, domainId)` to the workspace predicate.
   - Require membership in the workspace; viewers can read, editors can reply
     and change status.
   - Add `getConversationDomainForMember` so a deep link can resolve the
     conversation's domain before the list is loaded.

2. **Validation** (`services/api/src/chat/schemas.ts`)
   - Add `conversationListSchema` for the optional domain filter.
   - Add `conversationIdParamSchema` for the page's `conversationId` query
     parameter.

3. **Page** (`apps/web/app/dashboard/conversations/page.tsx`)
   - Read `domainId` and `conversationId`.
   - Resolve the requested domain against the active workspace's domains.
   - Resolve a deep link's domain; the conversation wins over a stale filter and
     the page redirects to the canonical URL with both ids.
   - Render domain filter chips when the customer has more than one domain.
   - Pass the effective domain, its name, and whether to show domain labels to
     the client.

4. **Client** (`apps/web/components/conversations/conversations-page.tsx`)
   - Pass the domain filter to the 10-second poll.
   - Make the polling effect depend on the scope.
   - Reset the open conversation when the scope changes.
   - Show the domain name on rows only in All domains mode.
   - Use the domain name in the empty state.

5. **Sidebar** (`apps/web/components/dashboard/app-sidebar.tsx`)
   - Use `domainHref()` for the Conversations link so an active domain carries
     into the inbox.

6. **Domain tabs** (`apps/web/components/domains/domain-tabs.tsx`)
   - Update the stale comment. Conversations stays a top-level inbox with a
     domain filter rather than becoming another tab.

## Edge cases

- Invalid or stale `domainId`: redirect to All domains.
- Deep link for a conversation in another domain: conversation domain wins.
- Domain switch while a chat is open: clear the selection.
- Single domain: no filter chips; the list is effectively scoped.
- A domain from another workspace: the workspace predicate returns no rows.
- A workspace member who did not create the domain: they see every conversation
  in the workspace; only editors can reply or change status.
- Sidebar badge remains workspace-wide for now; scoping it is a separate change.

## Verification

- `pnpm --filter @repo/api check-types`
- `pnpm --filter web check-types`
- `pnpm --filter web lint`
- `pnpm --filter web test`
- With two domains in one workspace:
  - All domains shows both.
  - Each domain chip shows only that domain.
  - Clicking Conversations from a domain page keeps the domain.
  - A deep link opens the right conversation and canonicalises the URL.
  - The 10-second poll does not re-blend the list.

All dev/build commands stay within 3 CPUs and 3 GB RAM:

```bash
NODE_OPTIONS="--max-old-space-size=3072" taskset -c 0-2 pnpm --filter web build
```

## Status

Implemented on 2026-11-19. `@repo/api` and `web` typechecks pass, `web` lint
passes, all API and web tests pass, and the production build passes under the
3 CPU / 3 GB limit.

Workspace-member access was completed on 2026-11-21: the inbox is scoped by
workspace membership instead of `domains.ownerId`, and viewers are read-only.
Browser verification with two domains and a non-owner workspace member now
passes in `e2e/workspace-access.spec.ts`.

## Out of scope

- Per-user unread state: `ownerSeenAt` is shared by the workspace.
- Campaigns domain scoping.
- Pagination beyond the existing 100-conversation cap.
