# Notifications and the escalated-conversation badge

## Simple version

When a visitor asks for a human, Ziyarn writes a notification to the database
and sends the existing email. The Conversations link in the sidebar shows a red
number of chats that are still escalated, so the number stays until the chat is
resolved or closed, not just until the notification is read. A bell in the
header shows unread notifications; click one to open that chat. Opening the chat
marks the notification read, but the sidebar number only drops when the chat
itself is resolved or closed. The system works after a refresh or a server
restart, does not create duplicate notifications when the same escalation is
reported twice, and an email failure never hides the escalation in the app.

Notifications are temporary, not a permanent audit log: they expire after 30
days and the existing cron job deletes them. The sidebar count does not depend
on notification rows, so cleanup can never hide a conversation that is still
escalated.

One limit: today only a domain owner can open that domain's conversations, so
notifications go to the domain owner. Letting every workspace member receive
them needs a separate conversation-access change.

---

## What was true before implementation (verified)

- `apps/web/components/dashboard/app-sidebar.tsx` already shows a badge on
  Conversations, but it is the total number of **unread messages**, not
  escalated conversations.
- `apps/web/hooks/use-unread-count.ts` polls
  `getTotalUnreadAction` every 10 seconds.
- `services/api/src/chat/server.ts` `getTotalUnreadCount` counts messages newer
  than `ownerSeenAt` for domains owned by the user. It does not scope by active
  workspace.
- `escalateConversationToHuman` sets the conversation status to `escalated` and
  sends an email. It does not write any in-app notification.
- `DashboardToastListener` treats any increase in unread messages as
  `"New escalation"`, which is not accurate — a normal visitor message also
  triggers it.
- `apps/web/app/dashboard/conversations/page.tsx` does not read a
  `conversationId` query parameter, so the existing email link lands on the
  conversation list instead of the conversation.
- There is no `notifications` table.
- Conversation access is owner-only (`requireOwnedConversation` checks
  `domains.ownerId`), even though domain access for other workspace members is
  broader.
- The active workspace is a client-set cookie, validated server-side against
  workspace membership.

## Scope

In scope:

- short-lived in-app notification for a conversation escalation;
- notification bell, unread badge, list, mark-one-read, mark-all-read;
- automatic expiry and cleanup after 30 days;
- sidebar count of open escalated conversations in the active workspace;
- opening the exact conversation from a notification;
- toast, tab title, browser notification, and sound driven by real
  notifications instead of raw unread-message counts;
- failure handling, idempotency, ownership checks, cascade deletes, tests.

Not in scope:

- a notification for every visitor message (that is a separate type);
- email notification preferences or a mute centre;
- WebSockets, SSE fan-out, or a push service;
- workspace-wide recipient fan-out (needs conversation access widened first);
- a full notifications history page (the bell list is the recent-history view
  for now).

## Decisions

1. **Store notifications in Postgres, not memory.** Polling plus a durable row
   survives server restarts, dropped requests, and multiple app instances. No
   in-memory event bus.
2. **One notification row per conversation escalation.** `dedupeKey` is
   `conversation_escalated:<conversationId>`. A new episode after resolve
   updates the same row and makes it unread again; a repeat while still
   escalated leaves it alone. It never creates a duplicate.
3. **The sidebar count is open escalated conversations, not unread notification
   rows.** A read notification is an acknowledgement; an unresolved escalated
   conversation still needs attention. This also means a failed notification
   insert cannot hide an active escalation from the sidebar.
4. **The bell count is unread notifications.** It is the event inbox. Reading
   the bell does not resolve the conversation.
5. **Bell notifications are per user across their workspaces.** Missing an
   escalation is worse than showing a workspace label. Clicking an item switches
   the active workspace before opening the conversation.
6. **Sidebar count is for the active workspace.** It matches the conversation
   list the user is currently looking at. Notifications in other workspaces are
   still visible in the bell.
7. **Recipients are domain owners.** This matches the current conversation
   access and the current escalation email. Workspace-wide fan-out is a separate
   security change.
8. **Poll every 10 seconds, reuse the existing shared-polling pattern.** No new
   realtime infrastructure. Worst-case delay is 10 seconds.
9. **Notifications are temporary.** Keep them for 30 days, then delete them.
   They are delivery metadata, not an audit log. The bell is recent history, not
   permanent storage. The list is also capped at 30.
10. **Replace the old sidebar unread-message badge with the escalated count.**
    Per-conversation unread counts remain in the conversation list. If both are
    wanted, a second muted badge can be added later; one badge is clearer now.

## Data model

Add to `packages/database/src/schema/index.ts` after `conversations` (avoids a
schema import cycle). Migration `0039_notifications.sql`, additive only.

`notifications`:

| column | type | notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | text | FK `user.id` (auth user), cascade |
| `workspace_id` | uuid | FK `workspaces.id`, cascade |
| `domain_id` | uuid, nullable | FK `domains.id`, cascade |
| `conversation_id` | uuid, nullable | FK `conversations.id`, cascade |
| `type` | text enum | starts with `conversation_escalated` |
| `dedupe_key` | text | server-generated, e.g. `conversation_escalated:<id>` |
| `title` | text | snapshot for display |
| `body` | text | snapshot, truncated around 500 chars |
| `read_at` | timestamptz, nullable | null means unread |
| `created_at` | timestamptz | first event |
| `updated_at` | timestamptz | latest event, used for ordering and expiry reset |
| `expires_at` | timestamptz | delete after this; 30 days from the latest event |

Indexes:

- unique `(user_id, dedupe_key)` — idempotency;
- `(user_id, updated_at)` — bell list;
- `(user_id, read_at)` — unread count;
- `(conversation_id)` — mark all for a conversation;
- `(workspace_id)` — workspace diagnostics/future filtering;
- `(expires_at)` — cron cleanup.

Why `dedupeKey` instead of only `(user, type, conversation)`:

- it keeps the door open for non-conversation notifications later;
- it makes the conflict target explicit and stable;
- a null conversation can still be handled by a future type.

Cascade behaviour:

- delete user → notifications go;
- delete workspace → notifications go;
- delete domain → notifications go;
- delete conversation → notifications go;
- deleting an agent cascades its conversations, so those notifications go too.

No changes to `conversations`; status remains the source of truth for the
sidebar count.

## Escalation flow

In `escalateConversationToHuman`:

1. Read the conversation's current status and the domain's `ownerId`,
   `workspaceId`, and `name`.
2. Set the conversation status to `escalated` (existing behaviour).
3. If it was already `escalated`, do not send another email. Still run an
   `onConflictDoNothing` insert as a repair: it creates the row if a previous
   write failed, but leaves an existing row's read state alone. This prevents
   duplicate emails and still recovers a missing in-app row.
4. If this is a new escalation episode:
   - write the notification with the upsert below (best effort, separate
     `try/catch`);
   - send the existing email (best effort, separate `try/catch`).
5. If the notification write fails, log `escalation_notification_failed`; the
   email may still send, and the sidebar still shows the escalated conversation.
6. If the email fails, log `escalation_email_failed`; the notification still
   exists.
7. Re-escalation after `resolved`/`closed` is a new episode: the same row is
   upserted to `read_at = null` and `updated_at = now()`.
8. The email recipient comes from the Better Auth `user` table. The legacy
   `users` table is empty, so the old lookup never sent escalation emails.

Notification content:

- title: `New escalation in <domain name>`;
- body: the last visitor message, truncated; fall back to the escalation reason,
  then to `"A visitor is waiting for a human agent."`;
- `dedupeKey = conversation_escalated:<conversationId>`;
- store workspace/domain/conversation IDs for navigation and cleanup.

Upsert:

```ts
insert(notifications)
  .values(row)
  .onConflictDoUpdate({
    target: [notifications.userId, notifications.dedupeKey],
    set: {
      readAt: null,
      title,
      body,
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
```

Independent failure isolation is intentional: email and in-app delivery must not
be able to cancel each other.

## Read semantics

Mark related notifications read when:

- the user clicks a notification;
- the user opens the conversation (existing `markConversationSeen`);
- the owner replies (they have clearly seen it);
- the conversation status changes away from `escalated` (active, resolved, or
  closed);
- the user chooses "Mark all as read".

Do **not** remove the notification on read. Keeping it gives the user a short
history in the bell and makes the unread count reproducible from the row state.

## Retention and cleanup

Notifications are not permanent. The default retention is **30 days** from the
latest event (`expires_at = now() + 30 days`, reset on a new escalation
episode). Keep it as one constant, `NOTIFICATION_RETENTION_DAYS`, so changing
the policy does not touch call sites.

Two defences:

1. Queries only return `expires_at > now()`, so an expired row disappears from
   the bell even if cleanup has not run yet.
2. The existing protected cron endpoint
   (`GET /api/campaigns/process-scheduled`) calls
   `pruneExpiredNotifications()` alongside the existing rate-limit prune. It
   runs every 10 minutes from `.github/workflows/cron.yml`, so no new scheduler
   is needed. Cleanup is independent of campaign sending: a prune failure must
   not stop campaign delivery.

Delete:

```sql
DELETE FROM notifications WHERE expires_at < now();
```

The sidebar count is unaffected because it comes from `conversations.status`.
If a conversation stays escalated for more than 30 days, its notification
expires but the sidebar still shows the open escalation. That is the safety net.

If the concern is data sensitivity rather than volume, the stricter variant is
a 7-day TTL and a generic body such as `"A visitor is waiting for a human
agent."`; the title, domain, and conversation link are enough to navigate. The
current plan stores a short visitor-message snippet for usefulness.

Rows deleted earlier by a cascade are removed by the foreign keys as before;
the prune only handles rows that expired naturally.

## Service layer

New `services/api/src/notifications/` module.

System functions (no session required, called by chat or cron):

- `notifyConversationEscalated(db, input)` — idempotent upsert;
- `ensureConversationEscalationNotification(db, input)` — repair insert that
  does not reopen an existing read row;
- `markConversationNotificationsRead(db, userId, conversationId)` — used by
  seen/reply/resolve paths;
- `pruneExpiredNotifications(db)` — called by the existing cron; returns deleted
  count.

Session service `createNotificationsService({ db, getSession })`:

- `summary(headers, activeWorkspaceId)` →
  `{ unreadNotificationCount, openEscalatedCount, latestNotification }`;
- `list(headers, limit = 30)` — newest `updatedAt` first, joins workspace/domain
  names, excludes `expires_at <= now()`;
- `markRead(headers, notificationId)` — scoped update, returns
  `{ workspaceId, conversationId }` or throws 404;
- `markAllRead(headers)` — scoped update, returns count.

`summary` is three small indexed queries:

1. unread notification count for the session user where `expires_at > now()`;
2. latest notification (read or unread) for toast/browser text and navigation,
   also excluding expired rows. Using the latest event rather than latest
   *unread* stops an old unread row from toasting when the newest row is marked
   read. The client also ignores events older than two minutes, so a delayed
   poll or a prune cannot toast an old row;
3. open escalated conversation count for the active workspace, joining
   `conversations → agents → domains` and checking `domains.ownerId = userId`,
   `domains.workspaceId = activeWorkspaceId`, `conversations.status = 'escalated'`.

`latestNotification` includes `id`, `updatedAt`, `workspaceId`, and
`conversationId` so the toast/browser notification can detect a re-escalation
and switch workspace before navigating.

## Server actions

New `apps/web/lib/actions/notifications.ts`, following the existing
`requireOwner`/`ActionResult` pattern:

- `getNotificationSummaryAction()`;
- `listNotificationsAction()`;
- `markNotificationReadAction({ id })`;
- `markAllNotificationsReadAction()`;
- optionally `openNotificationAction({ id })` if the click path wants one
  atomic "mark read + return target" call. `markNotificationReadAction` already
  returns the target, so one action is enough.

Each action:

- gets the session from `authService`;
- uses `user.id` from the session, never a client-supplied user ID;
- resolves the active workspace through
  `resolveActiveWorkspaceId` only for the sidebar count;
- returns serialised dates, not `Date` objects.

## UI

### Header bell

New `apps/web/components/dashboard/notification-bell.tsx`, placed in the
dashboard header next to `HeaderCreateMenu`, visible on mobile too.

- Bell icon from `lucide-react`.
- Red count badge, capped `9+` or `99+`.
- Accessible label includes the unread count.
- Click opens the existing `Sheet` component from the right:
  - title "Notifications";
  - "Mark all as read" button;
  - `ScrollArea` list, max 30;
  - each item: title, body (2-line clamp), workspace/domain label, relative
    time, unread dot;
  - read items are muted but remain visible;
  - empty state: "You're all caught up.";
- Clicking an item:
  1. calls `markNotificationReadAction`;
  2. sets the active workspace cookie if the notification belongs to another
     workspace;
  3. navigates to
     `/dashboard/conversations?conversationId=<id>`;
  4. closes the sheet.
- After any read action, call `refreshNotificationSummary()` so the bell badge
  and sidebar update immediately.
- While the sheet is open, refetch the list when the summary's latest marker
  changes, so a new escalation appears without closing the sheet.

### Sidebar

`AppSidebar` uses the shared summary hook:

- `openEscalatedCount > 0` renders the existing `SidebarMenuBadge` on
  Conversations;
- destructive/red styling, cap `99+`;
- accessible label: `"N escalated conversations"`;
- no badge when zero;
- the old `totalUnread` message badge is removed from the sidebar. Per-
  conversation unread counts stay in the conversation list.

### Tab title, toast, browser notification, sound

Replace `useUnreadCount` in the three consumers with
`useNotificationSummary`:

- `DashboardTitleUpdater` shows unread notification count when the tab is
  hidden;
- `DashboardToastListener` seeds the last-seen `id:updatedAt` marker on mount
  (so it does not toast old rows), then shows a toast only when that marker
  changes. Tracking `updatedAt` matters because a re-escalation updates the same
  row rather than inserting a new ID;
- toast says "New escalation" with the real body and a "View" action that
  switches workspace if needed and opens the conversation;
- browser notification and sound remain best-effort when the tab is hidden;
- browser notification click focuses the tab and opens the conversation;
- all in-app delivery is the source of truth; if permission is denied, the bell
  still works.

New `apps/web/hooks/use-notification-summary.ts`:

- same module-level polling pattern as `use-unread-count.ts`;
- one interval shared by all consumers;
- `fetchPending` guard prevents overlapping requests;
- `refreshNotificationSummary()` forces an immediate poll and notifies
  listeners;
- on failure, keep the last known summary rather than showing zero.

### Conversation deep link

`apps/web/app/dashboard/conversations/page.tsx`:

- read `searchParams` (`conversationId`, optionally `workspaceId`);
- pass `initialConversationId` to `ConversationsPage`;
- `ConversationsPage` opens it once on mount if the ID exists in the loaded
  list (guard with a ref so it does not reopen after every poll);
- the existing email link starts working as a deep link too.

For the bell path, the client sets the workspace cookie before navigation, so
the server renders the correct workspace immediately. For an email from another
workspace, the existing limitation remains: the user may need to switch
workspace first. A small `workspaceId` activator can be added later if email
deep links must auto-switch.

## Polling and refresh

- Keep the existing 10-second cadence; do not add WebSockets.
- The shared hook is mounted by the sidebar/title/toast, so there is one timer.
- Conversation list polling stays separate and already refreshes statuses every
  10 seconds.
- Force a refresh after read actions, replies, and status changes.
- Worst-case user-visible delay for a new escalation is 10 seconds, which is
  acceptable with email as the immediate channel.

## Security and edge cases

- Every read/mark action requires a session and scopes by `user.id`.
- `markRead` updates `where id = ? and user_id = ?`; a missing row is a 404, not
  a silent success.
- Notification links are derived from stored conversation IDs, never from a
  client-supplied URL.
- Opening a notification returns the stored workspace and conversation IDs;
  the workspace cookie is still validated by the server against membership.
- Notification rows are deleted when the user, workspace, domain, agent,
  conversation, or message chain is deleted, via cascades.
- Repeated escalation calls hit the unique index and update the same row.
- Email and notification writes have independent error handling; neither can
  prevent the status change.
- Sidebar count comes from conversation status, not notification delivery, so a
  failed notification cannot hide an escalation.
- The list is capped and indexed; no unbounded query on each poll.
- Browser notifications are permission-based and may not appear; the in-app
  bell is always authoritative.
- Multiple open tabs may each show a toast for the same new row. The database
  still has exactly one notification; a cross-tab leader election is not worth
  the complexity for this version.
- Recipients: domain owners only, because conversation access is owner-only
  today. Workspace-wide notifications require changing conversation access
  first.

## Tests

API/service tests:

- `notifyConversationEscalated` creates one row and a second call updates the
  same row, resets `readAt`, and bumps `updatedAt`;
- re-escalation after resolve reopens the notification;
- escalation still sets status when the notification write fails;
- escalation still creates the notification when email sending fails;
- already-escalated conversation does not send a duplicate email;
- `summary` unread count ignores read rows;
- `summary` open-escalated count is scoped to the owner and active workspace;
- resolving/closing marks the related notifications read;
- `markRead` cannot read or update another user's notification;
- `markAllRead` only touches the current user;
- `markConversationNotificationsRead` only touches the user's conversation;
- expired notifications are excluded from the list and unread count;
- `pruneExpiredNotifications` deletes only expired rows;
- a prune failure does not stop campaign processing.

Web tests/manual:

- deep link with `conversationId` opens the conversation once;
- bell badge updates after mark read;
- sidebar count stays after reading but drops after resolve;
- toast only fires for a real new escalation, not a normal visitor message;
- browser notification click opens the right conversation;
- workspace switch from a notification loads the correct workspace;
- empty state and `99+` cap.

Existing checks:

- `pnpm --filter @repo/api check-types` and `lint`;
- `pnpm --filter web check-types` and `lint`;
- web production build with
  `NODE_OPTIONS="--max-old-space-size=3072" taskset -c 0-2 pnpm --filter web build`;
- API tests, web tests.

## Rollout

1. Add the schema and `0039_notifications.sql`.
2. Apply the migration manually (the drizzle journal is desynced); verify the
   table and indexes exist.
3. Add the service, actions, hook, bell, and sidebar/title/toast changes.
4. Add the prune call to the existing cron endpoint.
5. Add deep-link handling and docs.
6. Run typecheck, lint, tests, and the 3-CPU/3-GB production build.
7. Manual signed-in check: escalate from the widget, see the bell and sidebar
   count, open from both, reply, resolve, confirm both clear, then delete a test
   conversation/domain and confirm the notification is gone.
8. Manually expire one test row, run the cron endpoint, and confirm it is
   deleted while an old escalated conversation still shows in the sidebar.
9. Commit only when explicitly asked.

Rollback: the migration is additive and safe to leave in place. Reverting the
code stops writes/reads; the table can be dropped later if the feature is
abandoned.

## Files to change

- `packages/database/src/schema/index.ts` — notifications table;
- `packages/database/drizzle/0039_notifications.sql` — additive migration;
- `services/api/src/notifications/index.ts` — exports;
- `services/api/src/notifications/server.ts` — notification service/system
  functions;
- `services/api/src/notifications/schemas.ts` — IDs/limits/types if needed;
- `services/api/package.json` — exports map;
- `services/api/src/chat/server.ts` — escalation notification, read on seen/
  reply/resolve;
- `services/api/src/chat/index.ts` — export if needed;
- `apps/web/services/notifications-service.ts` — service singleton;
- `apps/web/lib/actions/notifications.ts` — server actions;
- `apps/web/hooks/use-notification-summary.ts` — shared polling;
- `apps/web/components/dashboard/notification-bell.tsx` — bell and sheet;
- `apps/web/app/dashboard/layout.tsx` — mount bell;
- `apps/web/components/dashboard/app-sidebar.tsx` — escalated badge;
- `apps/web/components/dashboard/dashboard-title-updater.tsx` — notification
  count;
- `apps/web/components/dashboard/dashboard-toast-listener.tsx` — notification
  ID-driven toast;
- `apps/web/app/dashboard/conversations/page.tsx` — search params;
- `apps/web/components/conversations/conversations-page.tsx` — initial open;
- `apps/web/app/api/campaigns/process-scheduled/route.ts` — call notification
  prune alongside rate-limit prune;
- `apps/web/content/docs/conversations.mdx` — docs including 30-day retention;
- tests under `services/api/src/notifications/`, `services/api/src/chat/`, and
  `apps/web/lib/` or `apps/web/components/` as appropriate.

Cleanup after the switch: remove `apps/web/hooks/use-unread-count.ts` and
`getTotalUnreadAction`/`getTotalUnreadCount` if no consumer remains.

## One decision to confirm

Notifications go to the **domain owner** because that is who can open the
conversation today. If "users" should mean every workspace member, the first
change is widening conversation access (list, read, reply, seen, status) to
workspace roles; after that, fan out notifications to those members. That is a
separate, security-sensitive change and is not included above.

## Recommended first cut

Ship the owner-only version above. It fixes the real gap (no durable in-app
escalation record), makes the sidebar count truthful, makes the bell useful, and
does not require changing conversation permissions.
