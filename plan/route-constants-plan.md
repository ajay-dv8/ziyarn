# Route constants — one source of truth for every path

**Status:** Phases 0–3 done. The constants exist and are verified against the
filesystem; every `apps/web` page path and handler path goes through
`APP_ROUTES` / `API_ROUTES`, and `apps/admin` has its own `ADMIN_ROUTES` /
`ADMIN_API_ROUTES`. Package boundaries (Phase 4) and the ESLint rule (Phase 5)
remain.

## Goal

Every internal path is written once, in a constants file, and referenced by name
everywhere else:

- page paths → `apps/web/constants/routes/routes.ts` (`APP_ROUTES`)
- HTTP handler paths → `apps/web/constants/routes/api-routes.ts` (`API_ROUTES`)

Today that is true for 25 page paths and 6 API paths. It is not true for the
other **122 route references** in the repo, which are string literals scattered
across 73 files.

The rule this plan enforces:

> A `/dashboard/...`, `/api/...` or `/portal/...` string literal may only exist
> inside the two constants files. Everywhere else, it is a name.

## What I measured

| Surface                  | Constants today | Raw references  | Files |
| ------------------------ | --------------- | --------------- | ----- |
| `apps/web` page paths    | 25              | 27 (+1 matcher) | 16    |
| `apps/web` handler paths | 6               | 53              | 39    |
| `apps/web` absolute URLs | —               | 5               | 2     |
| `apps/admin` page + API  | 0               | 24              | 12    |
| `packages/widget-core`   | 0               | 4               | 1     |
| `services/api`           | 0               | 9               | 5     |

`API_ROUTES` is the more embarrassing number: six entries, of which **five are
unused**, and it is imported in exactly **one** place
(`components/dashboard/knowledge-upload-button.tsx`). The other 53 call sites
build handler URLs by hand.

`APP_ROUTES` is in better shape — 26 files already reference it — which is why
this is a cleanup, not a rewrite.

## Why this matters

Not "DX" in the abstract. Four failures that this repo can already produce:

**1. The post-checkout redirect is duplicated across a package boundary.**
`services/api/src/billing/server.ts` builds `/dashboard/billing` four times
(lines 89, 90, 93, 114), while
`apps/web/components/dashboard/paystack-return-handler.tsx:41` builds the same
path independently. Rename the billing route and Stripe sends paying customers
to a 404 — and nothing fails at build time.

**2. The codebase already contains a private copy of `APP_ROUTES`.**
`apps/web/lib/actions/workspaces.ts:26` declares
`const TEAM_PATH = "/dashboard/team"`, a second name for
`APP_ROUTES.DASHBOARD_TEAM`. A rename updates one of them.

**3. Drift is visible inside a single function.**
`apps/web/app/dashboard/layout.tsx` redirects with `APP_ROUTES.SIGN_IN` on line
34 and with a raw `` `/accept-invite?token=${...}` `` on line 42. Whoever wrote
the second one did not know, or did not trust, `APP_ROUTES.ACCEPT_INVITE`.

**4. The widget's contract with every customer site is a bare string.**
`packages/widget-core/src/session.ts` hardcodes `/api/chat` four times. That path
is embedded in bundles already installed on customer sites. The web app keeps a
separate copy in `API_ROUTES.CHAT`. They are not connected by any type, test, or
build step.

## Bug found during Phase 0

Writing the `auth` group meant checking what Better Auth actually serves, and
the admin panel's sign-out is broken twice over:

```tsx
// apps/admin/app/admin/layout.tsx:52
{
  /* Sign-out is a better-auth server endpoint, not a page — it must be a
    full navigation, so <a> is correct here despite the lint rule. */
}
<a href="/api/auth/signout">Sign out</a>;
```

1. **The path is `/sign-out`, not `/signout`.** Verified in
   `better-auth/dist/api/routes/sign-out.mjs`, which registers
   `createAuthEndpoint("/sign-out", …)`.
2. **It is POST-only.** The comment is right that a full navigation is needed,
   but an `<a>` sends GET, so even the corrected path would 404.

Net effect: clicking **Sign out** in the admin panel rendered Better Auth's 404
JSON and left the session intact. **Fixed in Phase 3** — see "The sign-out bug"
there; it turned out to need a client component, not a form, because a form POST
lands on `{"success":true}` JSON instead of a page.

## Scope: what counts as a route

The scan flagged 27 "OTHER" matches that are deliberately not route constants.
Listing them here so nobody "fixes" them later:

| Thing                             | Where                                         | Why it stays                                                                                                   |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/dashboard/:path*`               | `apps/web/proxy.ts:13`                        | Next statically analyses `config.matcher`; a computed value is not supported. Keep the literal, add a comment. |
| `/login`, `/cart`, `/wp-admin`, … | `services/api/src/knowledge/crawler.ts:16-33` | These classify _crawled third-party links_, not our routes.                                                    |
| `/plan`, `/transaction/verify`    | `services/api/src/paystack/server.ts`         | Paystack's API, relative to `api.paystack.co`.                                                                 |
| `/widget.js`, `/favicon.ico`      | widget embed, toast listener                  | Static assets, not routes.                                                                                     |
| `/api/` (substring)               | `crawler.ts:32`                               | A filter for whether a crawled href is an API URL.                                                             |
| `GET /api/portal/pay failed:`     | log strings in `route.ts` handlers            | Diagnostic text. Turning it into a constant makes logs harder to read.                                         |

## Target design — shipped in Phase 0

Both files now exist in this shape.

### `routes.ts` — page paths

Flat object kept; it had 25 stable entries and 113 references. Four page paths
were added, taking it to 29 — one per page file:

```ts
export const APP_ROUTES = {
  // …existing 25 entries unchanged…
  UNSUBSCRIBE: "/unsubscribe",
  PORTAL_BOOK: "/portal/book",
  PORTAL_BOOKING: "/portal/booking",
  PORTAL_PAY: "/portal/pay",
} as const;
```

`DOCS: "/docs"` stays as-is even though the page file is `docs/[[...slug]]` —
`/docs` is the correct URL to link to.

### `api-routes.ts` — handler paths

The old six-entry flat object did not scale to 51 handlers. It was replaced with
a tree that mirrors the URL tree:

- a node with children is an object
- a static leaf is a string
- a dynamic leaf is a function
- `root` is the collection URL; `byId` is its `/:id` child

```ts
export const API_ROUTES = {
  auth: {
    // The mount is one file, app/api/auth/[...all]. The rest are Better Auth's
    // own endpoints, reached through authClient rather than by hand — listed so
    // nobody invents them as literals.
    root: "/api/auth",
    signInEmail: "/api/auth/sign-in/email",
    signUpEmail: "/api/auth/sign-up/email",
    callback: "/api/auth/callback",
    // Corrected while writing the file: Better Auth serves POST /sign-out.
    // The old /api/auth/signout appears in apps/admin and is a live bug — see
    // "Bug found during Phase 0".
    signOut: "/api/auth/sign-out",
  },
  agents: {
    root: "/api/agents",
    byId: (agentId: string) => `/api/agents/${agentId}`,
  },
  analytics: "/api/analytics",
  billing: {
    checkout: "/api/billing/checkout",
    portal: "/api/billing/portal",
    paystack: {
      cancel: "/api/billing/paystack/cancel",
      initialize: "/api/billing/paystack/initialize",
      reconcile: "/api/billing/paystack/reconcile",
      verify: "/api/billing/paystack/verify",
      webhook: "/api/billing/paystack/webhook",
    },
  },
  bookingSettings: {
    root: "/api/booking-settings",
    slots: "/api/booking-settings/slots",
  },
  bookings: {
    root: "/api/bookings",
    byId: (bookingId: string) => `/api/bookings/${bookingId}`,
  },
  campaigns: {
    root: "/api/campaigns",
    send: (campaignId: string) => `/api/campaigns/${campaignId}/send`,
    schedule: (campaignId: string) => `/api/campaigns/${campaignId}/schedule`,
    cancelSchedule: (campaignId: string) =>
      `/api/campaigns/${campaignId}/cancel-schedule`,
    processScheduled: "/api/campaigns/process-scheduled",
  },
  chat: "/api/chat",
  customers: "/api/customers",
  integrations: {
    databases: "/api/integrations/databases",
    stripeConnect: "/api/integrations/stripe-connect",
  },
  invite: {
    accept: "/api/invite/accept",
  },
  knowledge: {
    upload: "/api/knowledge/upload",
    crawl: "/api/knowledge/crawl",
    byId: (documentId: string) => `/api/knowledge/${documentId}`,
    file: (documentId: string) => `/api/knowledge/${documentId}/file`,
  },
  /** Catch-all: `key` is a slash-separated object path, not one segment. */
  logos: (key: string) => `/api/logos/${key}`,
  orders: {
    syncDatabase: "/api/orders/sync-database",
  },
  portal: {
    booking: "/api/portal/booking",
    pay: "/api/portal/pay",
  },
  products: {
    root: "/api/products",
    create: "/api/products/new",
    byId: (productId: string) => `/api/products/${productId}`,
    syncDatabase: "/api/products/sync-database",
  },
  public: {
    bookings: "/api/public/bookings",
    bookingSettings: "/api/public/booking-settings",
    bookingSlots: "/api/public/booking-slots",
  },
  settings: {
    root: "/api/settings",
    password: "/api/settings/password",
  },
  uploads: {
    logo: "/api/uploads/logo",
  },
  usage: "/api/usage",
  webhooks: {
    resend: "/api/webhooks/resend",
    stripe: "/api/webhooks/stripe",
  },
  workspace: {
    root: "/api/workspace",
    byId: (workspaceId: string) => `/api/workspace/${workspaceId}`,
    invite: (workspaceId: string) => `/api/workspace/${workspaceId}/invite`,
    inviteById: (workspaceId: string, inviteId: string) =>
      `/api/workspace/${workspaceId}/invites/${inviteId}`,
    memberById: (workspaceId: string, memberId: string) =>
      `/api/workspace/${workspaceId}/members/${memberId}`,
  },
} as const;
```

One entry per file under `app/api`, including handlers nothing currently calls
(`analytics`, `usage`, `billing.checkout`, `campaigns.processScheduled`,
`webhooks.*`, `workspace.*`). They are in the file because the file describes
the HTTP surface, not because they are used today. The coverage test below is
what keeps that honest.

**Verified against the filesystem, both directions:** 29 `APP_ROUTES` entries ↔
29 page files, 55 `API_ROUTES` entries ↔ 51 handler files. The extra 4 are the
Better Auth sub-paths, which live under the `[...all]` catch-all and are checked
as declared children of it. Every entry resolves to a real URL, and every page
and handler has an entry — no gaps, no strays.

One call site changed: `knowledge-upload-button.tsx` used
`API_ROUTES.KNOWLEDGE_UPLOAD`, which is now `API_ROUTES.knowledge.upload`. It
was the only consumer of the old flat object.

### Two rules that make this stay true

**Paths, not URLs.** A constant never contains a query string.

```ts
// yes
fetch(withQuery(API_ROUTES.customers, { domainId }));

// no — one caller's query becomes everyone's
fetch("/api/customers?domainId=");
```

Query strings vary per caller (`domainId`, `agentId`, `page`, `search`,
`range`). Baking one variant into the constant means the next caller appends a
second `?`.

**Dynamic segments are functions.** `` `${API_ROUTES.agents.root}/${id}` ``
reintroduces exactly the string building this plan removes, and nothing checks
that the result matches a handler.

### Optional: a query helper

Roughly 25 call sites hand-concatenate query strings; the admin pages have
nested ternaries producing `?page=1&search=x&plan=y`. A four-line helper removes
a whole class of `?`/`&` mistakes:

```ts
// apps/web/lib/url.ts
export function withQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
```

Optional because it changes ~25 call sites beyond the literal swap. Do it in the
same pass as the page that owns those sites, or not at all.

## The inventory

### Phase 1 — `apps/web` page routes (27 references)

| File:line                                              | Today                                        | Becomes                                                            |
| ------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| `lib/actions/conversations.ts:66,161,174`              | `revalidatePath("/dashboard/conversations")` | `APP_ROUTES.DASHBOARD_CONVERSATIONS`                               |
| `lib/actions/domains.ts:45,67,77`                      | `revalidatePath("/dashboard/domains")`       | `APP_ROUTES.DASHBOARD_DOMAINS`                                     |
| `lib/actions/workspaces.ts:26`                         | `const TEAM_PATH = "/dashboard/team"`        | delete; use `APP_ROUTES.DASHBOARD_TEAM` at use sites               |
| `app/dashboard/layout.tsx:42`                          | `` `/accept-invite?token=${…}` ``            | `APP_ROUTES.ACCEPT_INVITE` + query                                 |
| `lib/source.ts:5`                                      | `baseUrl: "/docs"`                           | `APP_ROUTES.DOCS`                                                  |
| `proxy.ts:7`                                           | `new URL("/sign-in", request.url)`           | `APP_ROUTES.SIGN_IN`                                               |
| `components/dashboard/app-sidebar.tsx:147`             | `` `/dashboard/domains?domainId=${…}` ``     | `APP_ROUTES.DASHBOARD_DOMAINS`                                     |
| `components/dashboard/bookings-client.tsx:96`          | `` `/dashboard/bookings?domainId=${…}` ``    | `APP_ROUTES.DASHBOARD_BOOKINGS`                                    |
| `components/dashboard/paystack-return-handler.tsx:41`  | `router.replace("/dashboard/billing")`       | `APP_ROUTES.DASHBOARD_BILLING`                                     |
| `components/dashboard/dashboard-toast-listener.tsx:82` | `router.push("/dashboard/conversations")`    | `APP_ROUTES.DASHBOARD_CONVERSATIONS`                               |
| `app/dashboard/knowledge/page.tsx:140`                 | `path="/dashboard/knowledge"`                | `APP_ROUTES.DASHBOARD_KNOWLEDGE`                                   |
| `app/dashboard/databases/page.tsx:78`                  | `path="/dashboard/databases"`                | `APP_ROUTES.DASHBOARD_DATABASES`                                   |
| `app/dashboard/analytics/page.tsx:98,117`              | `` `/dashboard/analytics?…` ``               | `APP_ROUTES.DASHBOARD_ANALYTICS`                                   |
| `app/dashboard/orders/page.tsx:63,67,90,128`           | `"/dashboard/orders"` + query + `action=`    | `APP_ROUTES.DASHBOARD_ORDERS`                                      |
| `app/dashboard/products/page.tsx:94`                   | `` `/dashboard/products?domainId=…` ``       | `APP_ROUTES.DASHBOARD_PRODUCTS`                                    |
| `app/dashboard/customers/page.tsx:68,72,98,136`        | `"/dashboard/customers"` + query + `action=` | `APP_ROUTES.DASHBOARD_CUSTOMERS`                                   |
| `proxy.ts:13`                                          | `matcher: ["/dashboard/:path*"]`             | **leave literal**, add a comment explaining Next's static analysis |

All 16 files migrated. Two judgement calls worth recording:

- `lib/actions/workspaces.ts` kept its `revalidateTeam()` helper and moved the
  constant inside it, instead of inlining `APP_ROUTES.DASHBOARD_TEAM` at every
  call site. The helper is useful deduplication; the private copy of the path
  was the actual problem (failure #2 above).
- `proxy.ts` imports `APP_ROUTES` for the `/sign-in` redirect but keeps the
  matcher literal, with a comment recording why.

Query strings were left untouched — every `?domainId=` still builds the way it
did, so this phase is a pure rename with no behaviour change. `withQuery`
remains open question 3.

### Phase 2 — `apps/web` handler paths (53 references, 39 files)

Grouped by the resource key each one maps to. Line numbers are from the current
tree.

| Resource        | Call sites                                                                                                                                     | Becomes                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| agents          | `create-agent-button:62`, `onboarding:341`, `agent-actions:61`                                                                                 | `agents.root`, `agents.byId(agent.id)`                                                       |
| billing         | `cancel-subscription:21`, `restore-plan:26`, `paystack-client:23`, `manage-subscription:15`, `upgrade-button:43,79`                            | `billing.paystack.cancel`, `.reconcile`, `billing.portal`, `.initialize`, `.verify`          |
| bookings        | `bookings-client:50,64`                                                                                                                        | `bookings.byId(id)`, `bookingSettings.root`                                                  |
| campaigns       | `create-campaign:62`, `send:18`, `schedule-campaign:63,88`                                                                                     | `campaigns.root`, `.send()`, `.schedule()`, `.cancelSchedule()`                              |
| chat            | `conversations-page:82,175`                                                                                                                    | `chat`                                                                                       |
| customers       | `backfill:15`, `customers-table:88`, `import-customers:63`, `sync-database:24`                                                                 | `customers`                                                                                  |
| integrations    | `connect-stripe:15`, `database-integration-card:93,205,252,272,312`                                                                            | `integrations.stripeConnect`, `.databases`                                                   |
| invite          | `accept-invite-button:18`                                                                                                                      | `invite.accept`                                                                              |
| knowledge       | `website-crawl-form:48,99`, `delete-knowledge:25`, `crawled-pages-card:80`, `knowledge/page:63`, `onboarding:414`                              | `knowledge.crawl`, `.byId()`, `.file()`, `.upload`                                           |
| logos / uploads | `uploads/logo/route:71`, `onboarding:230`                                                                                                      | `logos(key)`, `uploads.logo`                                                                 |
| orders          | `sync-database-orders:26`                                                                                                                      | `orders.syncDatabase`                                                                        |
| portal / public | `booking-form:53`, `booking-confirm:13`, `payment-button:15`, `portal/book:55,86`                                                              | `public.bookings`, `portal.booking`, `portal.pay`, `public.bookingSettings`, `.bookingSlots` |
| products        | `create-product:50`, `product-actions:49`, `product-grid:59,68`, `product-table:102,111`, `edit-product-sheet:60`, `sync-database-products:27` | `products.create`, `.byId()`, `.syncDatabase`                                                |
| settings        | `profile-form:32`, `default-currency:29`, `password:36`                                                                                        | `settings.root`, `.password`                                                                 |

`apps/web/app/api/uploads/logo/route.ts:71` is a handler _returning_ a URL that
the browser will later request; it still uses the constant.

All 39 files migrated, in two passes: an exact-match script (each edit carried an
expected occurrence count, so a drifted line failed loudly instead of being
skipped), then a normaliser that moved the new import into each file's existing
`@/` group in sorted order. `lib/paystack-client.ts` has no imports at all — it
is deliberately browser-safe — so its import was added by hand after the
docblock.

Query strings were again left alone. The build does not exercise a client-side
`fetch`, so the built chunks were searched afterwards for every path string the
migration touched; all 28 are present with their original values. (One, the
portal pay URL, appears as `` `${API_ROUTES.portal.pay}?t=` `` rather than a
contiguous literal — the bundler keeps the object and the concatenation
separate, which is why a naive grep for `/api/portal/pay?t=` misses it.)

### Phase 3 — `apps/admin` (24 references, 12 files) — done

Admin had no constants file at all. Its nav was six literal hrefs, every
pagination link a hand-built query string, and its auth redirect built in
`lib/admin-auth.ts`.

`apps/admin/constants/routes.ts` now holds the same pair of maps as `apps/web` —
admin is a separate Next app and cannot import `apps/web/constants`, so it gets
its own small file:

```ts
export const ADMIN_ROUTES = {
  HOME: "/admin",
  USERS: "/admin/users",
  USER: (userId: string) => `/admin/users/${userId}`,
  DOMAINS: "/admin/domains",
  DOMAIN: (domainId: string) => `/admin/domains/${domainId}`,
  WORKSPACES: "/admin/workspaces",
  CONVERSATIONS: "/admin/conversations",
  REVENUE: "/admin/revenue",
  SIGN_IN: "/sign-in",
  SETUP: "/setup",
} as const;

export const ADMIN_API_ROUTES = {
  auth: "/api/auth",
  setup: "/api/admin/setup",
} as const;
```

There is deliberately **no** `signOut` path. The plan originally listed
`"/api/auth/signout"`; that value does not exist. Better Auth serves
`/api/auth/sign-out`, POST only, so a path constant would only invite the
mistake that was already in the tree — see below.

All 12 files migrated:

- `app/admin/layout.tsx` — the six nav entries, `requireAdmin(...)`, sign-out
- `app/admin/domains/page.tsx`, `app/admin/domains/[domainId]/page.tsx`
- `app/admin/users/page.tsx`, `app/admin/users/[userId]/page.tsx`
- `app/admin/workspaces/page.tsx`, `app/admin/conversations/page.tsx`
- `app/admin/page.tsx` — `/setup`, `/admin`
- `app/sign-in/page.tsx` — the `/admin` fallback
- `app/setup/page.tsx`, `app/setup/setup-form.tsx` — `/api/admin/setup`, `/admin`
- `lib/admin-auth.ts` — `/sign-in?returnTo=…`

#### The sign-out bug, fixed on the way through

`app/admin/layout.tsx` rendered `<a href="/api/auth/signout">` (“Sign out is a
server endpoint, not a page — `<a>` is correct here”). It was wrong twice over.
The replacement is `components/sign-out-button.tsx`:

|      | before               | after                                          |
| ---- | -------------------- | ---------------------------------------------- |
| path | `/api/auth/signout`  | `/api/auth/sign-out`, resolved by `authClient` |
| verb | `GET`, from an `<a>` | `POST`, from `authClient.signOut()`            |

Verified against the production build while the old link was still present:

```
POST /api/auth/sign-out  (json body) -> 200 {"success":true}
GET  /api/auth/sign-out              -> 404
POST /api/auth/signout               -> 404
GET  /api/auth/signout               -> 404
```

So clicking the old link could only ever render a 404 and leave the session
alive. The component then does `router.push(ADMIN_ROUTES.SIGN_IN)` +
`router.refresh()`, the same pair the sign-in page already uses. It is the only
one of these references that changed behaviour rather than just spelling.

### Phase 4 — across package boundaries (18 sites)

Two different problems, both created by code that cannot import
`apps/web/constants`.

**4a — absolute URLs (14 sites).** These are not path literals; they are
`origin + path` strings, which is why they were invisible to the first pass.

| File:line                                                  | Path                             | Origin source             |
| ---------------------------------------------------------- | -------------------------------- | ------------------------- |
| `app/api/integrations/stripe-connect/route.ts:42,43,75,76` | `/dashboard/integrations`        | `BASE_APP_URL`            |
| `app/api/public/bookings/route.ts:80`                      | `/portal/booking`                | request-derived `baseUrl` |
| `services/api/src/billing/server.ts:89,90,93,114`          | `/dashboard/billing`             | `BASE_APP_URL`            |
| `services/api/src/chat/tool-executor.ts:253`               | `/dashboard/conversations`       | `BETTER_AUTH_URL`         |
| `services/api/src/paystack/server.ts:350`                  | `/dashboard/billing`             | `paystackReturnBase()`    |
| `services/api/src/portal/server.ts:146,148`                | `/portal/booking`, `/portal/pay` | `parseDomainUrl()`        |
| `services/api/src/email/server.ts:140`                     | `/unsubscribe`                   | `parseDomainUrl()`        |

Five of these live in `apps/web`, where the fix is
`absoluteUrl(origin, APP_ROUTES.…)`.

Nine live in `services/api`, which **cannot import `apps/web/constants`** — that
would invert the package dependency.

**4b — `packages/widget-core` (4 sites).** `session.ts` hardcodes `/api/chat` at
lines 127, 160, 225 and 231. The package already takes `apiBase` as config, so
the path is the same kind of contract. Options: a local `CHAT_PATH` constant
inside the package, or a `chatPath` field on `TransportConfig` supplied by the
host. Either works; importing `apps/web` does not.

See "Open questions" for the shared-package alternative that solves 4a and 4b.

## Guardrails

A migration this size rots without enforcement. Two checks, both cheap.

### 1. Route coverage test

`apps/web/lib/routes.test.ts` (vitest is already configured for `lib/**`):

- walk `app/**/page.tsx` and `app/api/**/route.ts` on disk
- normalise `[param]` to `[^/]+`, `[...param]` to `.+`, and optional
  `[[...param]]` to `(?:/.+)?`
- flatten `APP_ROUTES` and `API_ROUTES`; for function entries, call them with
  `fn.length` copies of `"__probe__"`
- assert both directions: every constant resolves to a real route file, and
  every route file has at least one constant

This catches a constant pointing at a deleted page and a new handler added
without a constant. It is ~60 lines and needs no build step.

Note: `vitest.config.ts` currently includes only `lib/**` and `components/**`.
Put the test in `lib/` rather than `constants/`, or extend `include`.

### 2. ESLint rule banning raw literals

Add an override in `apps/web/eslint.config.js`, ignoring the constants folder:

```js
{
  files: ["**/*.ts", "**/*.tsx"],
  ignores: ["constants/routes/**"],
  rules: {
    "no-restricted-syntax": [
      "warn",
      {
        selector: "Literal[value=/^\\/(dashboard|api|portal|sign-in|sign-up|docs|pricing|features|onboarding|accept-invite|unsubscribe)(\\/|$)/]",
        message: "Import the path from @/constants/routes instead of writing it here.",
      },
      {
        selector: "TemplateElement[value.raw=/^\\/(dashboard|api|portal)(\\/|$)/]",
        message: "Import the path from @/constants/routes instead of writing it here.",
      },
    ],
  },
}
```

`apps/web/package.json` already runs `eslint --max-warnings 0`, and the shared
config uses `eslint-plugin-only-warn`, so a warning here still fails `lint`.

Do **not** point the `proxy.ts` matcher at `APP_ROUTES.DASHBOARD` to satisfy the
rule. Next reads `config` with a static AST pass
(`extractExportedConstValue`), not by executing the module, and a template
literal with an interpolation fails it outright:

```
Unsupported template literal with expressions
```

— `node_modules/next/dist/build/analysis/extract-const-value.js:179`. An
imported identifier fails as `Unsupported node type "Identifier"`. Keep the
literal, add a comment, and leave the matcher file out of the rule.

### 3. What the framework already gives you (and doesn't)

`next typegen` already generates `.next/types/routes.d.ts` with `AppRoutes`
(29 pages) and `AppRouteHandlerRoutes` (51 handlers). That is a complete,
always-current manifest of the route surface — useful as a cross-check for the
coverage test, though the test reads the filesystem so it does not require a
prior build.

It does **not** type `href` today: `typedRoutes` is opt-in
(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/typedRoutes.md`),
and `next.config.js` does not enable it. Worth doing as a follow-up:

- `tsconfig.json` already includes `.next/types/**/*.ts`, so it would take
  effect with no other setup.
- `APP_ROUTES` values are `as const`, so they stay literal types and would be
  validated as-is.
- The ~20 template-literal links are non-literal and would each need
  `as Route`, per the same doc. That is the pass that makes it non-trivial, so
  do not bundle it into this migration.

## Migration order

Each phase is independently shippable and reviewable.

| #   | Phase                                                            | Why this order                                                   |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| 0   | ~~Rewrite `api-routes.ts`, add 4 `APP_ROUTES` entries~~ **done** | Verified 29 ↔ 29 pages and 55 ↔ 51 handlers, both directions     |
| 0b  | ~~Turn that verification into a committed test~~ **done**        | Lives in `lib/routes.test.ts`; proven to fail in both directions |
| 1   | ~~`apps/web` page routes (27)~~ **done**                         | Only the `proxy.ts` matcher is still a literal, by design        |
| 2   | ~~`apps/web` handler paths (53)~~ **done**                       | 39 files; query strings unchanged, so behaviour is unchanged     |
| 2   | `apps/web` handler paths (53)                                    | Biggest mechanical chunk                                         |
| 3   | `apps/admin` (24)                                                | Independent app; new constants file                              |
| 4   | Package boundaries (18)                                          | Needs the cross-boundary decision                                |
| 5   | ESLint rule                                                      | Must be last — it would fail on every unmigrated file            |

Verification for every phase:

```bash
pnpm --filter web check-types
pnpm --filter web lint
NODE_OPTIONS="--max-old-space-size=3072" taskset -c 0-2 pnpm --filter web build
```

…plus a signed-in click-through of any page whose link changed. The build does
not exercise a client-side `fetch`, so a typo in an API constant is invisible
until someone clicks.

## Edge cases the migration will hit

**`/api/logos/[...key]` is a catch-all.** `key` is already a slash-separated
object path (`<userId>/<uuid>.png`). The builder must not encode it.

**`/docs/[[...slug]]` is an optional catch-all.** `APP_ROUTES.DOCS` is `/docs`,
which is the correct link target. The coverage test must treat the optional
segment as "allowed but not required".

**`revalidatePath` takes a path, not a URL.** `APP_ROUTES.*` values are paths, so
they are safe. Do not pass `withQuery(...)` to it.

**`<form action>` is a URL.** `orders/page.tsx:128` and `customers/page.tsx:136`
use `action="/dashboard/orders"` for a GET form. Constants work, but the
resulting query string must still be built by the form's inputs.

**`as const` + functions.** `as const` keeps the function signatures intact, so
`API_ROUTES.agents.byId(agentId)` is typed. It does make every node `readonly`,
which is fine — nothing mutates them.

**Two apps, two auth mounts.** `apps/admin` has its own
`app/api/auth/[...all]`, so `/api/auth/*` in admin refers to admin's mount. Do
not share the web app's auth constants there.

**`services/api` is not `API_ROUTES`.** `services/api` is the in-process service
layer; `constants/routes/api-routes.ts` is the Next.js HTTP surface. They share
a word, not a purpose. Worth a sentence at the top of `api-routes.ts` so the
next reader does not try to merge them.

## Rejected alternatives

**Generate the constants from the filesystem.** A script could walk `app/` and
emit `routes.ts` on every build. Rejected: it adds a generated file to review,
loses the hand-written names (`DASHBOARD_BILLING` is clearer than
`DASHBOARD_BILLING_PAGE`), and cannot name dynamic builders. At 51 handlers the
coverage test gives the same protection for a fraction of the machinery.

**One flat `SCREAMING_SNAKE` object for API routes.** 51 keys sorted
alphabetically is unreadable; `PRODUCTS_SYNC_DATABASE` and
`PRODUCTS_BY_ID` do not show which resource they belong to. The tree also makes
"add a child to `workspace`" obvious.

**Put query strings in the constants.** Tempting because `?domainId=` appears
~25 times. Rejected: the parameter set differs per caller, and one baked variant
misleads the next person into appending a second `?`.

**Rename `APP_ROUTES` keys to match the new tabs.** Out of scope. The tabs are
navigational; the constants are paths. Renaming 113 references buys nothing.

## Open questions

**1. Do `services/api`, `apps/admin` and `widget-core` share a package?**

The audit makes the case: three deployables need the same paths, and
`services/api` already builds dashboard URLs independently of the web app.

- **Option A — per-app constants (this plan).** `apps/web/constants/routes/*`
  stays as specified; admin gets its own file; `widget-core` gets a local
  constant. No new package, but `/dashboard/billing` exists in two places and
  `/api/chat` in two places.
- **Option B — `@repo/routes`.** Move `APP_ROUTES`, `API_ROUTES` and
  `absoluteUrl` into `packages/routes/src/`, and re-export from
  `apps/web/constants/routes/*` so the existing import path keeps working. One
  source of truth for all four consumers; `apps/web/constants/routes/routes.ts`
  becomes a one-line re-export rather than the definition.

Option B is architecturally correct, but it moves the definition out of the file
you named. Recommend deciding this **before Phase 5**, not before Phase 2 —
Phases 2-4 are unaffected either way.

**2. Do inbound-only routes belong in `API_ROUTES`?**

`/api/webhooks/stripe`, `/api/webhooks/resend`,
`/api/billing/paystack/webhook`, `/api/campaigns/process-scheduled` are called by
third parties or a scheduler, never by our code. Including them documents the
surface but creates constants nothing imports. The coverage test assumes they
are included. Say if you would rather exclude them.

**3. Should `withQuery` ship with this, or separately?**

It touches ~25 call sites that are already being edited in Phases 2-4, so the
marginal cost is low. It is also the only change here that alters behaviour
rather than names. My default: include it, phase by phase, not as a separate
sweep.

## Definition of done

- [x] `APP_ROUTES` covers all 29 pages (added `UNSUBSCRIBE`, `PORTAL_BOOK`,
      `PORTAL_BOOKING`, `PORTAL_PAY`)
- [x] `API_ROUTES` covers all 51 handlers under `apps/web/app/api`
- [x] No `/dashboard`, `/api`, `/portal` literal outside the constants files —
      except `proxy.ts`'s matcher, with a comment
- [x] `apps/admin` has `constants/routes.ts` and imports it everywhere
- [ ] `packages/widget-core` has one named chat path, not four literals
- [x] Route coverage test committed and passing in both directions (covers
      `apps/web`; `apps/admin` has only two handlers and no test yet)
- [ ] ESLint rule enabled and `pnpm --filter web lint` clean
- [ ] `check-types`, `lint`, and the 3 CPU / 3 GB build all pass
- [ ] Signed-in walk-through: dashboard pages, one admin page, the portal
      booking flow

**Known blocker for the lint items.** `pnpm --filter web lint` is already red on
`main`, before any of this work: `bookings/page.tsx:27` and
`create-agent-button.tsx:18` both have an unused import, and the script runs
`eslint --max-warnings 0`. Two deletions fix it, but they are unrelated to
routes, so they are left alone here. Until they are done, verification for every
phase is `check-types` + build + the coverage test.
