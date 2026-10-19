# Widget redesign + core architecture

Plan only. Nothing here is implemented yet.

Two things are decided:

1. **The look.** The widget should look like the reference design: a rounded
   chat card over a dimmed page, visitor messages as dark pills on the right,
   agent messages on the left with an avatar and a sender label, a copy button
   on messages, a composer that animates in before the conversation appears, and
   a collapsible card while the agent is using a tool.
2. **One core, many shells.** All the widget's behaviour *and* its rendering live
   in one place. The custom element, the React package and the iframe are thin
   adapters over it, so a design change lands everywhere at once and nothing can
   drift.

This extends [`widget-integration-surfaces.md`](./widget-integration-surfaces.md),
which covers the delivery surfaces. Read that one first; this one is the design
and the module layout.

---

## Part 1 — the design

### 1.1 Anatomy

Read top to bottom, with today's class names so the mapping is unambiguous:

```
.zy-wrap                      fixed, bottom-right (or centred in modal mode)
  .zy-panel                   the chat card — rounded, bordered, shadowed
    .zy-header-close           × in a circle, top-left of the card
    .zy-messages               the scroll area
      .zy-msg-zy-msg-agent     agent row: avatar + label + text, left
      .zy-msg-user             visitor row: dark pill, right
      .zy-msg-owner            human teammate row (already exists)
      .zy-tool-card            collapsible "running a tool" card
      .zy-msg-copy             copy button, appears on the message row
    .zy-note                  "Powered by Ziyarn"
  .zy-composer                its own pill, OUTSIDE and below the card
    .zy-composer-field         input + rotating hint
    .zy-send / .zy-stop        send, or stop while streaming
```

Changes from today:

- **The composer leaves the card** and becomes a pill beneath it. This is what
  makes the open animation read as "the input arrived first".
- **Agent rows gain an avatar and a label** ("Powered by AI" / the agent's name).
- **Visitor rows gain a copy button.**
- **A tool card** appears mid-reply while the agent is using a tool.
- **A stop button** replaces send while a reply is streaming.

### 1.2 The open animation

The launcher morphs into the composer, and the card rises behind it:

1. Click launcher → launcher scales down and fades; the composer pill scales in
   from the same corner.
2. ~120 ms later the card fades and rises 12px into place beneath it.
3. Reverse on close, with the card leaving first.

The input is focused at the end of step 1, so a visitor can type before the
conversation has finished animating. Implemented as CSS transitions driven by
`data-open` on `.zy-wrap`, plus one `transitionend`-free timeout for the focus
call — no animation library, because this ships to every customer page.

Reduced motion: `@media (prefers-reduced-motion: reduce)` collapses every step
to an instant show, which the widget already does for the Glow orb.

### 1.3 Two presentations

| Presentation | Behaviour | Plan |
|---|---|---|
| **Docked** (default) | Bottom-right bubble, card grows above it | Every plan |
| **Modal** (the reference) | Centred card, page dimmed behind it, wider | A widget variant, gated by the plan like Classic/Glow |

The presentation is a property of the variant in
`services/api/src/domains/widget-variants.ts`, so it is picked per domain in the
dashboard like the others, and the existing plan allowance covers it. Today the
free plan includes `classic` only; Modal becomes a paid variant.

### 1.4 Message and tool-card behaviour

- Agent rows: avatar, sender label, then the text. Markdown as today.
- Visitor rows: right-aligned dark pill, plus a copy button that appears on hover
  and stays put on touch devices (there is no hover to rely on).
- Tool card: collapsed by default, showing the tool's display name
  (`answer_knowledge` → "Knowledge search", `sell_product` → "Product lookup", …).
  Clicking expands it. It renders *above* the streaming text so it stays visible
  while tokens arrive.
- Stop: aborts the in-flight fetch; the partial reply stays on screen, marked as
  stopped. Aborting mid-stream already works — the server honours the request
  signal — so this is widget-side only.
- Errors keep today's behaviour: an error row in place of the reply.

### 1.5 The tool card needs no backend work

I was wrong earlier: the API **already forwards tool activity**. The AI layer
emits `{ type: "tool", name }` (`services/ai/src/index.ts:36`), and the chat
stream forwards it (`services/api/src/chat/server.ts:821`). The widget simply
ignores it today — it handles `text`, `escalate`, `done`, `error` and nothing
else. So the card is entirely widget work.

What it does *not* have is a result: the event carries the tool name only, not
what it found. If we want the card to expand into something useful ("found 3
documents"), the event needs `args` and a truncated `result`. That is the one
optional API addition, and it is additive — old widgets ignore the new fields.

---

## Part 2 — the core

### 2.1 The constraint, stated honestly

One view with zero duplication **or** a small bundle, not both. Someone has to
own the rendering:

- If the core renders the DOM (as today), the bundle stays at ~28 KB gzip and
  every shell is a thin adapter — but a React app cannot restyle internals with
  JSX.
- If React renders the view, there is exactly one design in one language — but
  React ships to every customer site (+~14 KB gzip).

**Decision: the core owns the view.** Zero duplication wins, the bundle stays
small, and "design it once" means exactly that. Styling control for customers
comes from CSS variables plus `::part()` hooks, which is enough for branding
without opening the shadow root.

### 2.2 Layout

```
packages/widget-core/            no DOM assumptions, no React
  src/transport.ts               fetch wrapper, error normalisation
  src/stream.ts                  SSE parsing (text, tool, escalate, done, error)
  src/session.ts                 send, stream, stop, reconnect, conversation id
  src/store.ts                   visitor id + conversation id, namespaced by slug
  src/markdown.ts                renderMd (moved out of helpers.js)
  src/events.ts                  the public event surface every shell emits

apps/web/widget/                 the core + the DOM shell, as today
  preamble.js helpers.js orb.js base.css variants/*.js
  shell/dom.js                   renders the panel, composer, messages, tool card
  engine.js                      wiring only: shell ← → core

apps/web/components/widget/      React adapter (already exists, gets events)
packages/widget-react/           Phase 2 — published package (typed wrapper +
                                  a headless useZiyarn() hook, no UI)
```

The rule: **`apps/web/widget/` may not import from the shells, and the shells may
not contain behaviour.** All conversation logic — what to send, when to stream,
what to store, what to reconnect — lives in `widget-core` and is exercised by
unit tests for the first time in this project's history.

### 2.3 What the React package offers

| Export | What it is |
|---|---|
| `<ZyWidget slug secret …/>` | The same widget, typed props and callbacks (`onReady`, `onOpen`, `onMessage`, `onError`) |
| `useZiyarn({ slug, secret })` | The core with **no UI**: `send`, `stop`, `messages`, `status`. For React apps that want their own design |
| `createZiyarn(config)` | Framework-free, for non-React and native clients later |

### 2.4 Drift prevention

- One core, one view, one stylesheet. Shells are ~60 lines each.
- A **visual contract test**: the same fixtures rendered through the element and
  through the React package are screenshotted and compared.
- The **behavioural harness** (`pnpm --filter web test:widget`) covers the core
  paths end to end in a browser, and Phase 2 extends it to mount all three
  surfaces against one fake API.

---

## Part 3 — phases

Each phase ends with something demonstrable and a green harness.

**Phase 0 — plan (this document).**

**Phase 1 — extract the core.** Move transport, stream, session and store out of
`engine.js` into `packages/widget-core`; add an esbuild step to
`build-widget.mjs` so the core is inlined into the single file. No behaviour or
visual change.
*Accept:* the bundle is still one file, no runtime dependencies, and
`test:widget` is unchanged at 19/19.

**Phase 2 — the new shell.** Rebuild `shell/dom.js` to the anatomy above:
composer outside the card, agent rows with avatar and label, visitor pills with a
copy button, the stop button, and the open animation.
*Accept:* the harness covers the new anatomy; a screenshot of each step is
reviewed side by side with the reference.

**Phase 3 — the tool card.** Render `{ type: "tool", name }` as a collapsible
card using display names from the tool registry.
*Accept:* a tool-using turn shows the card and collapses/expands; the harness
asserts it against a fake tool event.

**Phase 4 — modal presentation.** Centred card with a backdrop, as a new variant
in the widget registry, gated by the plan like the others.
*Accept:* the variant is selectable per domain and refused for a plan without it.

**Phase 5 — React package.** `packages/widget-react` with `<ZyWidget>` and
`useZiyarn()`, consuming the same core. Replaces the internal
`components/widget/zy-widget.tsx`.
*Accept:* the contract test compares the element and the React package.

**Phase 6 — iframe.** The same bundle served from our origin in an iframe page,
plus a `postMessage` bridge for open/close.
*Accept:* works on a strict-CSP host page.

**Phase 7 — publish and document.** `@ziyarn/react` on npm, a docs page with the
three surfaces and when to pick each, a changelog entry, and the migration note
for anyone on the old snippet.

### Sequencing note

Phases 1–2 are the ones that matter: after Phase 2 the new design is live on
every existing customer site with no action from them, and every later phase is
additive. Phases 4–7 can be reordered or dropped without reopening 1–3.

---

## Part 4 — decisions needed before Phase 1

1. **Composer above or below the card?** The reference puts it below; you also
   floated "the chat appears at the top". My recommendation: composer pill
   first, card above it, input focused immediately. Confirm or overrule.
2. **Modal as a paid variant, or free?** The plan allowance already gates
   widgets; I would put Modal behind the same allowance as Glow.
3. **Copy button: hover-only, or always visible?** Touch devices have no hover.
4. **Tool card: collapsed and contentless, or expanded with results?** Showing
   results means the API starts sending `args` and a truncated `result` — a
   small additive change I am happy to make, but it is a decision, not a detail.
5. **Keep the old look available?** A third "compact" presentation would let
   existing customers keep what they have. Costs one variant and some CSS.