# Chat triggers — selectable & customizable widget launchers

Analysis + implementation plan. Decisions with the owner: **v1 ships launcher
styles only** (bubble / glass orb / labeled pill — no auto-open behaviour) plus
the **editable launcher tooltip** (text, and whether it shows on hover or
always), and **all plans may use every trigger** (no `chatTriggers` gate in
PlanLimits; the registry shape leaves room for one later if wanted). Written
after reading the widget runtime
(`apps/web/widget/*`), the variant pipeline (`services/api/src/domains/
widget-variants.ts`, `services/api/src/chat/server.ts`, `apps/web/scripts/
build-widget.mjs`), the domain settings UI (`apps/web/components/domains/*`)
and `packages/database/src/schema/domains.ts`.

## 1. What exists today

The **chat trigger** is the always-visible element on a customer's site that
opens the chat (`.zy-launcher`). Today it is NOT user-selectable — the visitor
gets whatever launcher the domain's widget variant ships:

| Variant | Launcher today | Where it lives |
|---|---|---|
| Classic | Static circle button with speech-bubble SVG | `variants/classic.js` markup + `variants/classic.css` |
| Glow | Static circle button with orbit SVG | `variants/glow.js` + `variants/glow.css` |
| Modern Sleek | Animated WebGL "Strands" glass orb | `strands.js`, mounted by `engine.js _mountSleek()` |

Key mechanics already in place that this plan reuses:

- **Server-authoritative config**: the embed snippet passes no style; the widget
  fetches `GET /api/chat` before mounting (`engine.js connectedCallback`) and
  the response includes `widgetVariant` (`services/api/src/chat/server.ts:
  handleChatConfig`). Dashboard changes apply to live sites without customers
  re-pasting snippets.
- **Registry pattern**: `WIDGET_VARIANTS` in
  `services/api/src/domains/widget-variants.ts` is the single source of truth;
  the dashboard picker, config endpoint and runtime all read from it. The DB
  column is plain `text` so adding options never needs a migration.
- **Plan gating**: `PLAN_LIMITS.widgetVariants` gates variants per plan, clamped
  in `clampWidgetVariantForPlan` so downgrades can't strand visitors.
- **Runtime registry**: `build-widget.mjs` has `VARIANTS = ["classic","glow","sleek"]`,
  inlines each variant's CSS as `VARIANT_CSS`, and each variant registers itself
  via `registerWidget(id, { css, markup, ... })`. Base CSS owns the shared
  `.zy-launcher` behaviour (position, hover, open/close icon swap, mobile rules).
- **Preview = real runtime**: the dashboard's domain preview and the
  widget-preview page render the actual `/widget.js` custom element
  (`zy-widget.tsx`), so anything the engine learns to render is previewed
  automatically. `chat-widget.tsx` (the Sleek iframe surface) has no launcher —
  the engine owns it.

## 2. The design — a second axis, built exactly like the variant axis

Add an independent, per-domain **chat trigger** setting that composes with any
widget variant. Same laws as variants: one registry row = the whole feature,
plain-text column (no enum), server-authoritative, plan-clampable, dashboard
picker, live previews.

**Back-compat anchor**: trigger value `"default"` (the column default) means
"use the launcher built into my widget variant" — bit-for-bit today's behaviour.
No existing site changes until the owner picks a trigger.

### Trigger registry — `services/api/src/domains/chat-triggers.ts` (new)

```ts
export const CHAT_TRIGGERS = [
  {
    id: "default",
    label: "Match my widget",
    description: "The launcher built into your widget style",
    fields: [],
  },
  {
    id: "bubble",
    label: "Icon bubble",
    description: "A plain circle button with your logo or a chat icon",
    fields: ["iconSource"],          // "chat-icon" | "logo"
  },
  {
    id: "orb",
    label: "Glass orb",
    description: "The animated Strands orb from Modern Sleek, on any widget",
    fields: [],
  },
  {
    id: "pill",
    label: "Labeled pill",
    description: "A rounded button with your text — greets visitors by name",
    fields: ["label"],               // free text, e.g. "Chat with us"
  },
] as const;

export const DEFAULT_CHAT_TRIGGER = "default";
// resolveChatTrigger(): unknown → valid id (fail open, like resolveWidgetVariant)
```

Per-trigger customization rides `chatTriggerConfig` (see "Tooltip" below for the
shape and defaults).

`fields` drives the dashboard form per trigger; unknown fields are ignored.

### Tooltip

Cross-trigger feature the engine always renders — including for the `default`
trigger, so even a stock-looking launcher can carry it:

- **Text**: `chatTriggerConfig.tooltip`, trims to ≤32 chars. Default
  `"Chat with us"` (constant `CHAT_TRIGGER_TOOLTIP_DEFAULT`).
- **Visibility**: `chatTriggerConfig.tooltipVisibility`, enum
  `"never" | "hover" | "always"`.
  - **Default `"never"`** — keeps the back-compat promise: no existing widget
    changes until its owner turns the tooltip on.
  - When a user picks a trigger in the dashboard, the picker preselects
    **"On hover"** so the feature is discoverable without surprising anyone.
  - `"always"` renders the standard "Chat with us" chip pattern (icon plus a
    text chip beside the bubble, like WhatsApp widgets).
- **Engine**: after mounting the launcher (whoever owns it), the engine injects
  a `.zy-tip` element and sets its text with `textContent` (no `innerHTML`).
  Reading the tip display mode and text happens in the same config the engine
  already awaits before mounting.
- **CSS**: styles live in `base.css` (variant-independent) keyed off
  `.zy-launcher .zy-tip`, flipping sides on `[data-position="bottom-left"]`.
  The tip is `aria-hidden` — the launcher keeps its `aria-label="Open chat"`,
  so screen readers get one clean annotation, not two.
- `has-tooltip` handling must survive `data-open="true"`: the tip hides when
  the panel is open (same rule family that hides the launcher on mobile), and
  `always` mode caps the chip to two lines so it never fights cramped headers.


### Database — `packages/database/src/schema/domains.ts`

Two new columns on `domains` (one `drizzle-kit generate` migration):

```ts
chatTrigger: text("chat_trigger").notNull().default("default"),
chatTriggerConfig: jsonb("chat_trigger_config")
  .$type<ChatTriggerConfig>().notNull().default({}),
```

`chatTriggerConfig` is a JSONB bag (`{ label?: string, iconSource?: string }`),
validated by zod in `services/api/src/domains/schemas.ts`. One column instead
of N-ish migration cycles: "customize" fields can grow without schema churn.
(Drizzle's `jsonb().$type<T>()` gives typed reads; unknown keys are dropped at
the service boundary, never trusted by the runtime.)

### Server

- `handleChatConfig` adds the trigger to the config payload, resolved and
  clamped the same way the variant already is:

```ts
chatTrigger: resolveChatTrigger(domain.chatTrigger),        // unknown → default
chatTriggerConfig: parseChatTriggerConfig(domain.chatTriggerConfig),
```

- `updateDomainSchema` (`schemas.ts`) accepts optional `chatTrigger` +
  `chatTriggerConfig`; the domain service validates config shape against the
  selected trigger's `fields` (e.g. `pill` requires label ≤ 32 chars; `bubble`
  requires iconSource ∈ {chat-icon, logo}; empty/whitespace label → field
  dropped). Ownership checks live in the existing update path — nothing new.
- Optional (defer): add `chatTriggers: ChatTriggerId[]` to `PlanLimits` for
  paid-only triggers. The structure supports it; not in v1 scope.

### Widget runtime — `apps/web/widget/`

The crucial refactor: **variants stop owning the launcher when a custom trigger
is selected.**

1. **Selection** (`engine.js connectedCallback`): the pre-mount config fetch
   already runs. Resolve `data.chatTrigger` with the `data-trigger` attribute
   as offline fallback (same precedence as `widgetVariant`/`data-variant`);
   anything unknown → `"default"`. One round trip, still no snippet change.

2. **Variant markup flag**: each `registerWidget(id, {...})` markup function
   receives `config.trigger`. When it isn't `"default"`, the markup omits the
   `.zy-launcher` button (classic/glow: skip one block; sleek: also skip
   `mountStrands` in `_mountSleek`). Default path stays byte-identical.

3. **New runtime registry** — `apps/web/widget/triggers.js` (new source, built
   like the variants):

```js
registerTrigger("bubble", { css: TRIGGER_CSS.bubble, markup: function (config) {…} });
registerTrigger("orb",    { css: TRIGGER_CSS.orb, markup: … });     // reuses strands.js
registerTrigger("pill",   { css: TRIGGER_CSS.pill, markup: … });   // label via textContent
```

   - Each trigger keeps the `.zy-launcher` class name (plus `zy-trigger`), so
     ALL existing positioning, hover, open/close icon-swap and mobile-hide CSS
     in `base.css` keeps working for free. Trigger CSS only adds what's
     specific (pill sizing, logo image, orb canvas).
   - `build-widget.mjs`: add `TRIGGERS = ["bubble","orb","pill"]`, inline their
     CSS as `TRIGGER_CSS` (mirror of `VARIANT_CSS`), keep the same
     "forgot-an-id" guard error pattern.
   - Custom text/label is set with `textContent` (never `innerHTML`) — the XSS
     rule already used for the response streams.

4. **Engine glue** (`_mountVariant` / `_mountSleek`): after
   `root.innerHTML = …`, if trigger ≠ default, `insertAdjacentHTML` the trigger
   markup into `.zy-wrap`, append its CSS into the same `<style>` block, bind
   `this._launcher` to it. `_toggle()` and header-close wiring are untouched.
   For the orb trigger call `mountStrands(...)` (the code path that already
   exists in `_mountSleek`), and honour `strands.destroy()` in the existing
   `_destroyThinking`/disconnect cleanup (single rAF/WebGL loop — one launcher,
   never two).

5. **Optional behaviour trigger (separate step)**: `autoOpenSeconds` in
   `chatTriggerConfig` — after the delay, if the visitor never opened the chat
   and the tab is visible, call `_toggle()` once. Pure engine addition, no UI
   on the site, respects prefers-reduced-motion users (skip auto-open for them;
   also good taste for notification-permission-style UX).

### Dashboard — `apps/web/components/domains/`

- Placement (decided): the domain's **Settings tab**, inside the existing
  "Widget" card of `domain-settings-panel.tsx` — below `WidgetVariantPicker`,
  card heading stays "Widget" with the description broadened to "How your chat
  looks to visitors". No new tab: a dedicated Appearance tab would hold exactly
  one picker + two fields, and a new tab costs a `?tab=` route entry
  (plan/domain-tabs-plan.md). If customization ever grows, promote then.
- New `chat-trigger-picker.tsx`, modelled on `widget-variant-picker.tsx`:
  radio group built from `CHAT_TRIGGERS`, plan allowance read from limits
  (v1: all allowed), Save via `updateDomainAction(domainId, { chatTrigger,
  chatTriggerConfig })`.
- Per-trigger customization fields render below the selected option
  (`pill` → label input; `bubble` → icon choice chat-icon/domain-logo).
- **Tooltip controls** render for every trigger: a text input
  (placeholder/value `"Chat with us"`) and a visiblity select —
  `Hidden / On hover / Always` (Hidden pre-selected only for domains that
  never touched triggers; selecting any trigger preselects `On hover`).
- Mount it in `domain-settings-panel.tsx` next to `WidgetVariantPicker` and
  pass it through `dashboard/domains/page.tsx` (already passes `widgetVariant`).
- The preview (`WidgetPreviewSwitcher`) loads the real `widget.js` against the
  domain's embed secret → picks up the saved trigger from the config endpoint
  with zero extra work. Verify the "current" preview tab reflects it.

### Embed snippet

**No change.** Same `<zy-widget>` tag; trigger rides the config endpoint like
the variant already does.

## 3. Implementation order (each step shippable, small diffs)

1. **Foundation (invisible)**: registry file + tests, schema columns +
   migration, zod schemas, domain update path, config endpoint payload.
   Everything defaults to `"default"` → no behaviour change.
2. **Runtime**: `triggers.js` + build script `TRIGGERS`/`TRIGGER_CSS` + engine
   glue (select/insert/strip-variant-launcher). Ship bubble + pill + orb.
3. **Dashboard**: picker + fields + action.
4. **Optional**: auto-open behaviour, then plan gating.

## 4. Verification hooks

- `services/api/src/domains/widget-variants.test.ts` gets a sibling
  `chat-triggers.test.ts` (resolve/clamp/parse cases).
- Puppeteer check following the existing landing-page test pattern: test domain
  with each trigger → host page asserts the right launcher markup exists, opens
  the chat, mobile (390px) shows no overlap, `default` still renders the old
  launchers.
- Typecheck/lint gates + dashboard preview screenshots.

## 5. Risks / notes

- **Old `widget.js` in host pages**: trigger (like variant) arrives via config
  endpoint — but the *rendering* code ships in widget.js itself. Hosts that
  cache the old script get the current look until it reloads (documented
  behaviour of the variant pipeline already; `widget.js` is fetched from the
  app origin on each page load — script defer, no long cache — so drift window
  is short).
- **WebGL on low-end devices**: the orb is today's Sleek launcher; reuse keeps
  its perf profile and its destroy() discipline. It's opt-in per domain.
- **`$inferSelect` churn**: adding columns touches `Domain` type — only
  additive, all consumers read fields defensively already via services.
