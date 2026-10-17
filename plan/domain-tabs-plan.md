# Domain-scoped navigation — Agents and Knowledge become domain tabs

## What is actually wrong today

Not a design preference. Four verified facts:

**1. The data model is already domain-rooted.** `agents.domainId` is `NOT NULL`
with `onDelete: cascade`. Everything else hangs off it:

```
domains
└── agents (domainId NOT NULL, cascade)
    ├── knowledgeDocuments (agentId NOT NULL, cascade)
    │   └── documentChunks → embeddings
    ├── dataSources (agentId NOT NULL, cascade)
    ├── crawlJobs (agentId NOT NULL, cascade)
    └── conversations (agentId NOT NULL, cascade)
        └── supportTickets
```

`customers`, `products`, `bookings`, `payments`, `bookingSettings` carry
`domainId` directly. The domain is the root of every business object. **The
navigation is the only layer that does not reflect this.**

**2. There is a live context-loss bug.** The sidebar links to
`/dashboard/agents` and `/dashboard/knowledge` with no `?domainId=`. Both pages
then resolve:

```ts
domains.find((d) => d.id === domainId) ?? domains[0];
```

So a user with **Acme** selected clicks "Agents" and is silently shown **Beta's**
agents, with nothing on screen saying so. Same for Knowledge.

**3. Three copies of "which domain?".** The sidebar has a domain sub-list
(`?domainId=`). The Agents page has its own inline switcher. The Knowledge page
has its own inline switcher *plus* an agent switcher. They can and do disagree.

**4. The sidebar is already half domain-aware.** It reads `activeDomainId` from
the search params and relabels Bookings, Orders, Customers, Campaigns and
Products through `getBusinessTypeConfig(selectedDomain.businessType)`. So the
loosely-bound items respect the selected domain while the two *most* domain-bound
items discard it. That inversion is the smell.

## Scope: why this is staged

Only `agents` and `knowledge` accept `?domainId=`. These pages do not:

| Page | `?domainId=` | Table has `domainId` |
|---|---|---|
| agents | yes | yes (direct) |
| knowledge | yes | via `agentId` |
| conversations | **no** | via `agentId` |
| customers | **no** | yes (direct) |
| bookings | **no** | yes (direct) |
| orders | **no** | yes (direct) |
| products | **no** | yes (direct) |
| campaigns | **no** | **no scope key at all** |

So moving Conversations/Customers/Bookings/Orders/Products into domain tabs is
**not** an IA change — it is six pages of service-layer filtering that does not
exist yet. And Campaigns additionally needs a `domainId` column, i.e. a
migration.

**Stage 1 (this change):** Agents and Knowledge become domain tabs, and the
context-loss bug is fixed. No migration, no service changes.

**Stage 2 (not this change):** thread `domainId` through the remaining six
pages, migrate `campaigns`, then promote them to tabs. Documented here so the
next step is not rediscovered from scratch.

## Design

### The domain page is the hub

`/dashboard/domains` serves two modes off one route, selected by `?domainId=`:

- **absent** → the list of all domains, plus "New domain" (today's behaviour)
- **present** → that one domain: name, plan, slug, embed snippet, widget
  variant picker, live preview, and the tab bar

This matches how `agents` and `knowledge` already resolve a domain, so there is
one convention rather than two.

### One switcher, not three

The sidebar's domain sub-list is the **only** domain switcher. The inline
switchers on the Agents and Knowledge pages are deleted — they were duplicates
of a control that already exists one click away, and they were free to disagree
with it.

### The tab bar

`Overview | Agents | Knowledge`, rendered by one component on the domain page
*and* on the two sub-pages, so the user always sees where they are within a
domain and can move sideways without going back to the sidebar.

Every tab href carries `domainId`. That is the whole invariant.

### Sidebar

`Agents` and `Knowledge` are removed as top-level items — they now live under
Domains. Everything else stays: Overview, Domains (with the sub-list),
Conversations, the business-type items, Analytics, Usage, Customers, Orders,
Campaigns, Products, Billing, Integrations, Team, Settings.

## Invariants

- No schema migration
- No changes under `services/api`
- `/dashboard/agents` and `/dashboard/knowledge` keep working with no
  `?domainId=`, so existing bookmarks do not break. Only the sidebar entries
  change.
- Every tab href carries the selected `domainId`
- The sidebar sub-list is the only domain switcher; no page renders a
  competing one

## Risks

| Risk | Mitigation |
|---|---|
| Sidebar `isActive` goes stale when items move | `isActive` is derived from `pathname` + the new `domainId`, not hardcoded per item |
| Deep-linking `/dashboard/agents` with a stale `domainId` shows the wrong domain | Already today's behaviour; `resolveWidgetVariant`-style narrowing is out of scope here, but the page still falls back to `domains[0]` rather than erroring |
| The domain page's list mode and detail mode diverge | One page component, one branch on `searchParams.domainId`; the list branch is unchanged code |
