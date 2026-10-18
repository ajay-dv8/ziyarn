# Widget integration surfaces

Three ways for a customer to put the Ziyarn chat on their site, all speaking to
the same API and behaving identically. The **React component is the design
source of truth**; the element mirrors it and CI proves they still match.

## Why

Today's widget is a vanilla custom element with a Shadow DOM: 2,100 lines of
hand-written JS and 11.6 KB of hand-written CSS, shipped as one self-contained
file (97.8 KB raw / 27.6 KB gzip). It is the right *primitive* — it works on any
site, any CMS, with no build step — but it is the worst possible place to design
in, so the dashboard and the marketing site can never share a look with it.

## The shape

One implementation, three deliveries. There is no "port the design to the other
one" step, because there is only one design.

| Surface | What it is | Audience |
|---|---|---|
| `<ZyWidget />` in `@ziyarn/react` | **The** implementation — JSX, shared components, our Tailwind tokens | npm-based React apps (Next.js, Vite, Remix), and every first-party surface we build |
| `<zy-widget data-…>` custom element | Today's element. Keeps its own runtime and its Shadow DOM | Every other site: static HTML, WordPress, Shopify, Webflow, Squarespace, anything without a build step |
| iframe | The **same element bundle**, served from our origin inside an iframe | Customers who want it bulletproof and do not care how it looks |

A customer picks one. All three read the same API, share the same conversation
state, and are limited by the same plan (the server clamps the widget variant).

## Why the element stays vanilla for the first release

Compiling the React component into the element would make one implementation
instead of two, at the cost of shipping React to every site: 27.6 KB gzip → about
42 KB gzip. This product targets flaky mobile networks (see the rationale at the
top of `apps/web/scripts/build-widget.mjs`), so that regression is not worth it
yet.

Instead the two are kept honest by a **visual contract test**: the same fixtures
rendered by the React component and by the element are screenshotted and
compared in CI. Drift becomes a failing build rather than a support ticket. If
the bundle size ever stops mattering — or if the React element build proves
trivially small — the element can be switched to the React implementation as a
contained change, and the visual test becomes the fallback rather than the guard.

## Shared code

Everything that is not DOM lands in `@ziyarn/widget-client`:

- typed API client for `/api/chat` (config, history, send)
- SSE stream parsing and the owner-reply delta poll
- visitor id and conversation id, namespaced per domain
- reconnect and retry

The DOM layer (panel, composer, message rendering, the Glow orb) stays in
`apps/web/widget/`. This is also what makes a React Native or Flutter client
possible later: the transport is already renderer-agnostic, only the UI is not.

## Phase 1 — extract the client

No user-visible change. Move transport, storage and conversation state out of
`apps/web/widget/engine.js` into `packages/widget-client`, and add an esbuild
step to `build-widget.mjs` so the client is inlined into the single-file bundle.

The bundle stays one file with no runtime dependencies and no second request.

- [ ] `packages/widget-client` — `transport`, `store`, `session`, `types`
- [ ] esbuild step in `apps/web/scripts/build-widget.mjs` (bundle → IIFE literal,
      same treatment as the CSS)
- [ ] `engine.js` calls the client; no behaviour change
- [ ] Accept: widget renders, config fetch, send + SSE stream, owner delta poll,
      conversation restore after reload — all verified in a browser

## Phase 2 — the React component

Built on the client, with our Tailwind tokens and the same components the
dashboard uses. It becomes the design source of truth.

- [ ] `packages/widget-react` exporting `<ZyWidget>` with typed props
- [ ] Props mirror today's attributes: `slug`, `secret`, `title`, `subtitle`,
      `color`, `position`, `variant`, `api`
- [ ] Callbacks: `onReady`, `onOpen`, `onClose`, `onMessage`, `onError`
- [ ] Imperative handle: `open()`, `close()`, `reset()`
- [ ] Replaces `apps/web/components/widget/zy-widget.tsx` internally
- [ ] Accept: renders the same markup the element does, passes the contract test

## Phase 3 — iframe

Delivery mechanism, not a second implementation.

- [ ] `apps/web/app/embed/widget/page.tsx` — serves the element from our origin
      in a full-viewport frame
- [ ] `postMessage` bridge so the host page can open and close the chat
- [ ] Documented `frame-src` CSP line
- [ ] Accept: works on a strict-CSP site with no host CSS interference

## Phase 4 — publish and document

- [ ] Publish `@ziyarn/react` to npm (adds a real build; the workspace package
      stays raw TS for internal use)
- [ ] Docs page: the three options and *when to pick each*
      - element — any site or CMS, no build step
      - React package — npm apps, full theming control
      - iframe — bulletproof isolation, no styling control
- [ ] Changelog entry

## Cross-cutting

- **One feature set.** If the element cannot do something the component can,
  there are three support tracks. Anything not possible in the element is
  documented as such rather than half-built.
- **One contract test, three mounts.** Mount all three against a fake
  `/api/chat` and assert the same behaviour. The invisible-widget bug was
  invisible precisely because nothing reported the widget's state.
- **Load beacon.** `onReady` plus a `data-zy-ready` attribute, so a customer's
  site — and our own dashboard — can tell that the widget loaded. Add it to all
  three surfaces.
- **Shared tokens.** `--zy-color`, `--zy-text`, `--zy-muted`, `--zy-bg`,
  `--zy-border`, `--zy-radius`, `--zy-shadow` become the single source for both
  the element defaults and the React component.
- **`::part()`.** Tag the header, launcher, composer and message bubbles so
  customers can style the element from outside the shadow root without losing
  encapsulation. Cheap, and it answers most "I want to restyle this" asks
  without React at all.

## Risks

| Risk | Mitigation |
|---|---|
| The two surfaces drift | Visual contract test in CI |
| Bundle grows later | The client is ~5–8 KB gzip; measure before and after, and re-check at every phase |
| Three surfaces, three places for a bug like the invisible widget | Contract test plus the load beacon |
| Publishing to npm is a one-way door (a published version can never be un-published) | Publish only after the package has been consumed internally for a release; decide the scope and support window first |