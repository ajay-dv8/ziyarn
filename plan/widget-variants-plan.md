# Widget Variants Plan

Let each owner pick which Ziyarn widget appears on their site, and let them
preview every option before committing. Ships with **Classic** (today's widget);
two more follow.

Extends `plan/rebuild_divesai.md`. Pairs with `plan/voice-plan.md` — the
composer's capability chips (Deep search) must survive the split.

---

# 1 Decisions (confirmed)

| Question | Decision |
|---|---|
| Where does the variant live? | **Per domain.** Pick once; every site you embed into gets it. No HTML edits per site to switch. |
| Can preview show a variant the owner hasn't saved? | **Yes.** The switcher is for trying. |

---

# 2 Where the widget stands today

`apps/web/public/widget.js` — **1,370 lines**, 57 KB raw / **15 KB gzipped**,
zero dependencies, no build step, Shadow DOM, works in mobile/desktop WebViews.

Measured structure:

| Lines | Section | Engine or look? |
|---|---|---|
| 48–72 | `DEFAULT_API_BASE` | engine |
| **74–421** | **`STYLE`** (348 lines) | **look** |
| **422–430** | **`ICONS`** | **look** |
| 432–486 | `el()`, `esc()`, `renderMd()` | shared |
| 487–514 | `constructor` (config state) | engine |
| 515–670 | `connectedCallback` — reads attrs, builds shadow HTML | **mixed** |
| 672–696 | `_loadStore` / `_saveStore` | engine |
| 698–739 | `_init` | engine |
| 741–788 | `_loadHistory` | engine |
| 790–807 | `_toggle` — touches `.zy-wrap`, `.zy-panel` | **mixed** |
| 809–944 | composer: placeholder cycle, Deep search chip | **look** |
| 947–958 | `_appendMessage` — creates `.zy-msg` nodes | **mixed** |
| 960–967 | `_scrollToBottom` — `.zy-messages` | **mixed** |
| 969–993 | `_setStatus` — `.zy-header-status` | **mixed** |
| 995–1210 | `_send`, `_readStream`, `_fetch`, delta loop | engine |
| 1366 | `customElements.define("zy-widget", …)` | — |

## The coupling problem

**The engine and the look are fused through DOM class names.** `_toggle` reaches
for `.zy-panel`, `_scrollToBottom` for `.zy-messages`, `_setStatus` for
`.zy-header-status`, `_appendMessage` builds `.zy-msg-*` bubbles. Change the
markup and the engine breaks.

Doing this naively — copy `widget.js` three times and edit the cosmetics —
gives three copies of the chat logic that will drift apart and break
separately. **Avoiding that is the whole job.**

---

# 3 The split — the only real refactor

## 3.1 Two ways to do it

### Option A — Class names as the contract *(recommended)*

Every variant **must** keep the existing class names (`.zy-panel`,
`.zy-launcher`, `.zy-messages`, `.zy-msg`, `.zy-header-title`,
`.zy-header-status`, `.zy-composer`, …) and may add whatever else it likes.
The engine keeps querying them exactly as it does today.

- Engine changes: **small** — read `data-variant`, pick a build function
- Variant work: **only** write CSS + markup
- Cost: a variant that wants a fundamentally different structure is constrained
- 3 variants gzipped ≈ **45 KB**, one `<script>` tag, zero extra requests

### Option B — A `refs` handshake

Each variant's build function returns the nodes the engine needs, and the engine
never hardcodes a selector:

```js
{
  id: "classic",
  css: "...",
  markup: "...",
  icons: { ... },
  build(root) {
    return { panel, launcher, messages, headerTitle, headerSub,
             headerStatus, headerClose, input, sendButton, placeholder, deepChip };
  },
}
```

- Fully free-form variants
- Cost: ~25 engine methods rewritten to use `this._ref.panel` instead of
  `this._panel`, and every method becomes a point of failure
- Worth it only if a variant genuinely cannot live with Option A's names

## 3.2 Recommendation: **A now, B if it hurts**

Three widgets written by one team, all talking to the same API and sharing the
same capability chips — Option A gets ~80% of the benefit for ~20% of the work.
Take B only if widget #2 turns out to need a structure A cannot express.

## 3.3 Shape under Option A

```
widget.js
├── SHARED          DEFAULT_API_BASE, el(), esc(), renderMd()
├── VARIANTS
│   ├── classic     css + icons + markup        ← today's widget, unchanged
│   ├── <new>       css + icons + markup        ← you write this
│   └── <new>       css + icons + markup
├── ZyWidget        the engine — talks to /api/chat, SSE, delta, localStorage
└── register(name)  registers a variant; unknown names fall back to classic
```

---

# 4 Variant selection and the fallback rules

```html
<zy-widget data-slug="acme" data-secret="…" data-variant="classic"></zy-widget>
```

**Every customer already embedded has no `data-variant`.** So the resolution
order is:

| Input | Result |
|---|---|
| No attribute | `classic` |
| Unknown name (typo, retired widget) | `classic` |
| Owner picks a widget we do not ship | `classic` |
| Empty string / whitespace | `classic` |

**A bad variant name must never produce a blank chat bubble on a paying
customer's website.** Resolve to `classic` and `console.warn` — fail open, never
fail blank.

---

# 5 Data model

One column. Per-domain, as decided.

```sql
-- packages/database/drizzle/0028_widget_variant.sql
ALTER TABLE domains
  ADD COLUMN IF NOT EXISTS widget_variant text NOT NULL DEFAULT 'classic';
```

- `packages/database/src/schema/domains.ts` — add
  `widgetVariant: text("widget_variant").notNull().default("classic")`
- Default `'classic'` means every existing domain is already correct; the
  migration is a no-op for current rows and nothing to backfill.

⚠️ **Journal caveat:** `_journal.json` is already inconsistent (see
`plan/voice-plan.md` §13). Hand-write the SQL, apply to Neon, update the schema
file. `0027` is the admin auth tables.

### The registry lives in one place

Do **not** scatter variant names across the UI. A single module owns the list —
mirroring `PLAN_LIMITS` in `services/api/src/plans/server.ts`, the repo's
established single-source-of-truth pattern:

```ts
// services/api/src/domains/widget-variants.ts
export const WIDGET_VARIANTS = [
  { id: "classic", label: "Classic", description: "Floating bubble, bottom corner" },
  // add a row when a widget ships
] as const;

export type WidgetVariantId = (typeof WIDGET_VARIANTS)[number]["id"];
export const DEFAULT_WIDGET_VARIANT: WidgetVariantId = "classic";
export function isWidgetVariant(value: unknown): value is WidgetVariantId;
export function widgetVariantLabel(value: unknown): string;
```

The dashboard picker, the embed snippet, the config endpoint and the widget
registry all read from this one list. Adding a widget becomes **one row**.

---

# 6 What changes, end to end

| # | File | Change |
|---|---|---|
| 1 | `packages/database/drizzle/0028_widget_variant.sql` | new column |
| 2 | `packages/database/src/schema/domains.ts` | `widgetVariant` |
| 3 | `services/api/src/domains/widget-variants.ts` | **new** — the registry |
| 4 | `services/api/src/domains/schemas.ts` | `widgetVariant` on create/update |
| 5 | `services/api/src/domains/server.ts` | persist it; return it from `getEmbedConfig` |
| 6 | `apps/web/public/widget.js` | **the split** + `data-variant` dispatch |
| 7 | `apps/web/components/widget/zy-widget.tsx` | `variant` prop → `data-variant` |
| 8 | `apps/web/components/domains/embed-snippet.tsx` | emit `data-variant` |
| 9 | `apps/web/components/domains/widget-variant-picker.tsx` | **new** — the picker |
| 10 | `apps/web/components/domains/domain-card-menu.tsx` | add picker to the Edit dialog |
| 11 | `apps/web/app/dashboard/domains/page.tsx` | variant switcher on Live preview |

## 6.1 Embed snippet

Gains one line. Existing snippets keep working — that is the point of the
fallback in §4.

```html
<script defer src="https://…/widget.js"></script>
<zy-widget
  data-slug="acme"
  data-secret="…"
  data-variant="classic"
  data-title="Chat with us"
></zy-widget>
```

## 6.2 `GET /api/chat` config

Currently returns `domain`, `agent`, `placeholders`, `knowledgeSearch`. Add:

```ts
widgetVariant: domain.widgetVariant,
```

Useful for native SDKs (P-deferred) and for anything that renders the widget
outside the dashboard. **No secret or provider detail may appear here** — the
response is public to anyone holding the embed secret.

---

# 7 Owner experience

## 7.1 The picker

In the domain **Edit dialog** (the one built with Rename + Business type),
a variant section reading from `WIDGET_VARIANTS`:

- Radio group, one per variant: name + one-line description
- Shows the domain's current choice
- Saves through the existing `updateDomainAction` (zod-validated, owner-scoped)

## 7.2 Live preview switcher

Per your decision: **yes, preview can show an unsaved variant.**

```
Live preview
[ Classic ] [ Bubble ] [ … ]        ← switcher, defaults to the SAVED variant
  ┌──────────────────────┐
  │  the actual widget    │
  └──────────────────────┘
```

Two rules so it can't mislead:

1. **The switcher is local preview state only.** Flipping it must **never**
   write to the domain.
2. **The preview is not what's live until saved.** Label it. When the previewed
   variant differs from the saved one, say so — e.g. *"Previewing Bubble. Your
   site still uses Classic until you save."* An owner who thinks they changed
   the widget when they didn't is worse off than one with no preview.

**Implementation note:** the preview mounts a real `<zy-widget>` per variant
switch. The engine already guards double-init with `this._rendered`, but two
variants on one page must not collide — `data-api` and the namespaced
`localStorage` keys (`zy:<key>:<slug>`) already handle isolation. **Verify two
variants side by side** — this is the most likely place for a subtle bug.

---

# 8 Adding widget #2 and #3

After §3, this is the whole job:

1. Write the variant's CSS + icons + markup
2. `registerWidget("bubble", bubbleBuild)`
3. Add one row to `WIDGET_VARIANTS`

No engine changes, no API changes, no database migration, no dependency, no
build step.

### The non-negotiables a variant inherits for free

Because the engine is shared, these already work and must keep working:

- SSE token streaming and the typing indicator
- The delta long-poll that delivers owner replies after escalation
- Conversation + visitor persistence in `localStorage`
- Per-visitor rate limiting and plan gating (all server-side)
- The **Deep search chip** wired to `deepSearch` on the request
- Rotating per-business-type placeholders
- CORS + `x-embed-secret` auth

---

# 9 Backwards compatibility

The single most important constraint. Widgets are **already embedded on paying
customers' live websites** — we cannot break them.

| Must hold | How |
|---|---|
| Old snippets with no `data-variant` keep working | Resolve to `classic` |
| Unknown variant names never break the page | Resolve to `classic` + `console.warn` |
| Text chat behaviour is unchanged | Engine untouched in §3 (Option A) |
| Embed secret, API URL, stream format unchanged | No API change |
| `widget.js` stays at the same URL | One file, not three |
| `widget.js` stays dependency-free and buildless | No bundler added |
| Shadow DOM isolation preserved | Every variant styles only inside its shadow root |

---

# 10 Verification

Per repo convention — `check-types` + `lint` green, plus `next build`, plus
exercised against the running dev server. **`next build` is not optional here**:
the `/sign-in` prerender failure earlier was invisible to tsc and lint.

```bash
pnpm --filter @repo/api check-types && pnpm --filter @repo/api lint
pnpm --filter web           check-types && pnpm --filter web   lint
pnpm --filter web           build
node --check apps/web/public/widget.js
```

### Variant resolution

| Embed | Expect |
|---|---|
| No `data-variant` | renders Classic |
| `data-variant="classic"` | renders Classic |
| `data-variant="does-not-exist"` | renders Classic, warns in console |
| `data-variant=""` | renders Classic |
| A future real variant | renders that variant |

### Regression — the existing guarantees

- SSE streaming, typing indicator, token-by-token render
- **Enter sends, Shift+Enter newlines**
- Escalation → delta loop → owner bubble appears
- Conversation survives a page reload
- **A signed-in customer is still refused `/admin`** (re-run the admin E2E from
  the roles plan — unrelated but cheap to re-assert)

### Preview

- Switcher defaults to the **saved** variant
- Switching does **not** write to the domain (assert the DB is unchanged)
- Previewing an unsaved variant shows the "not live yet" label
- **Two variants mounted at once** do not collide

### Owner flow

- Change variant → save → embed snippet emits the new `data-variant`
- Reload the customer's page → new widget renders
- Old snippet with no attribute → still Classic

---

# 11 File checklist

## New

```
packages/database/drizzle/0028_widget_variant.sql
services/api/src/domains/widget-variants.ts
apps/web/components/domains/widget-variant-picker.tsx
```

## Modified

```
packages/database/src/schema/domains.ts            + widgetVariant
services/api/src/domains/schemas.ts                + widgetVariant (create/update)
services/api/src/domains/server.ts                 persist + getEmbedConfig
services/api/src/chat/server.ts                    + widgetVariant in handleChatConfig
apps/web/public/widget.js                          the split + data-variant dispatch
apps/web/components/widget/zy-widget.tsx           + variant prop
apps/web/components/domains/embed-snippet.tsx      emit data-variant
apps/web/components/domains/domain-card-menu.tsx   add picker to Edit dialog
apps/web/app/dashboard/domains/page.tsx            preview switcher
apps/web/content/docs/widget.mdx                   document data-variant
apps/web/content/docs/domains.mdx                  document choosing a widget
```

---

# 12 Open questions

1. **Does the widget name matter to customers?** Owners see "Classic" in a
   picker. Cute, or should it be descriptive ("Floating bubble", "Full screen",
   "Inline")? **Recommend internal ids stay short; the picker shows both a name
   and a plain description.**

2. **What if two variants need different `data-*` attributes?** e.g. a
   full-screen widget may not want `data-position`. Under Option A, unknown
   attributes are simply ignored — but a variant that needs one means the
   snippet generator must know which attributes to emit. **Recommend: the
   snippet emits the union of all attributes; harmless attributes are ignored.**

3. **Should the variant be per-domain or per-domain-per-site later?** Today a
   business with a marketing site and a booking site gets the same widget on
   both. **Recommend: revisit only if customers ask.** Per-domain keeps the
   snippet stable.

4. **Analytics — does the variant affect anything measured?** Not today.
   Consider tagging conversations with the variant so an owner can compare
   them later. **Recommend: record it in `conversations.metadata` at creation —
   cheap now, impossible later.**

5. **How many variants before this needs a build step?** Three in one file is
   ~45 KB gzipped and fine. If a fourth or fifth arrives with heavy styling
   each, splitting into lazy-loaded per-variant files becomes worth it.
   **Recommend: stay buildless until it hurts.**