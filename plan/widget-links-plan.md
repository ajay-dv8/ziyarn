# Widget Product & Page Links Plan

Status: Phases 1–2 implemented 2026-10-28. The About-page link passed a live
backend smoke test; Phase 2 code and migration are in place. Widget visual
checks remain pending. Phase 3 is deferred; its trigger and timing are tracked
in `plan/todo.md`.
Goal: every product or page the widget points a visitor to is a real,
absolute URL that opens the correct destination in a new tab.

Related:
- `plan/product-card-plan.md` §2 — the original product "Open" button spec.
  This plan owns the URL plumbing and page links; reuse that UI intent.
- `plan/knowledge-expansion-plan.md` — crawler and knowledge-base background.

---

## 1. Definition of done

- A reply that cites a crawled page contains a clickable link to the exact
  public page URL, not a guessed URL or a relative path.
- A product with a configured page URL has a visible "View product" action in
  the widget that opens that page.
- Products without a URL show no dead link.
- Payment and booking links continue to work exactly as they do today.
- Private pages (`/orders`, `/account`, `/cart`, …) are never offered as
  visitor-facing links.
- Works in Modern Sleek and Classic/Glow.
- No `javascript:`, `data:`, or other unsafe URL schemes reach an anchor.

---

## 2. What already works

- `apps/web/lib/widget-markdown.ts` (Sleek + dashboard preview) and
  `apps/web/widget/helpers.js` (Classic/Glow Shadow DOM) parse absolute
  `http(s)`/`mailto` links and bare URLs.
- Rendered links already use `target="_blank"` and
  `rel="noopener noreferrer"`.
- Tool-generated payment and booking portal URLs are absolute and already
  clickable.
- The renderers deliberately reject relative URLs and unsafe schemes; this
  should stay true unless URLs are normalized before rendering.

The click layer is therefore not the main problem. The missing pieces are
correct URL data, page-source propagation, and a product-page destination.

---

## 3. Gaps

| Area | Current behavior | Why it fails |
|---|---|---|
| Page links | `knowledgeDocuments.fileName` stores the crawled page URL, but `queryKnowledge` returns only chunk text and score. | The model never receives the page URL, so it cannot cite it reliably. |
| Page links | The system prompt gives the model the internal domain slug, not the public website URL. | The model can invent a URL such as `https://<slug>.com/...`. |
| Page content | `extractHtmlText` strips `<a href>` from crawled HTML. | Links mentioned inside a page are lost before chunking/embedding. |
| Product links | `products` has no URL column; `AgentProduct` has no URL. | Product cards open the in-widget viewer only; there is no real product-page destination. |
| Product links | Product data from Convex has no page URL. | Nothing can be linked until the owner or data source supplies it. |
| Relative links | Both renderers reject `/products/x`. | If allowed naively inside the Sleek iframe, the link resolves against the Ziyarn app origin, not the shop. |
| Private pages | The current Urban Plus crawl contains `/orders`. | Linking it would send visitors to a login/account page, not useful public content. |
| Uploaded docs | `knowledgeDocuments.fileName` is a filename, not a URL. | Must not be turned into a fake source link. |

Current data note: the Urban Plus crawl has five pages with URLs (`/`,
`/about`, `/contact`, `/reviews`, `/orders`) and no product pages. Its products
come from Convex with no URL. Page links can be shipped and tested now; product
links need product URL data first.

---

## 4. Decisions

1. **Product card interaction**: keep the current in-widget product viewer and
   add a "View product" action there. Do not make the whole card navigate away,
   because the viewer is the only place with the photo, description, share and
   download actions. Classic/Glow have no viewer, so their small card can be a
   link when a URL exists.
2. **Page links**: keep links inline in the assistant reply (markdown links),
   using exact source URLs. Do not build a separate page directory UI.
3. **Correctness**: prompt-only link generation is not a hard guarantee. Start
   with exact source URLs in the tool result and a strict prompt; if testing
   shows invented links, add a structured "Sources" row or a known-URL
   allowlist as a follow-up.
4. **Relative URLs**: normalize server-side against the business website URL.
   Keep the widget renderers absolute-only. Add a domain `websiteUrl` before
   supporting relative product/page URLs.
5. **Product URL source**: store `productUrl` explicitly. Do not infer product
   pages from product names. Prefer a full URL column; if a data source only
   has a slug/handle, require a base URL or a per-domain URL pattern.

---

## 5. Phase 1 — Page links (small; no DB migration)

### Backend

- [x] Extend `queryKnowledge` in `services/api/src/knowledge/server.ts` to
      return source metadata with each hit:
      - `title` / `source` from `knowledgeDocuments.title` or `source`
      - `url` from `knowledgeDocuments.fileName` only when it starts with
        `http(s)://` (crawled pages); never use an uploaded file name as a URL
      - keep `text` and `score` unchanged
- [x] Update the `answer_knowledge` case in
      `services/api/src/chat/tool-executor.ts` so each hit includes a source
      line, for example:
      `Source: <title> — <url>` when a URL exists, otherwise
      `Source: <title>`.
- [x] Add a system-prompt rule in `services/api/src/chat/server.ts`
      (`systemPromptFor`): when answering from a knowledge entry that has a
      source URL, link the page title to that exact URL. Never invent or
      construct a URL from the domain slug. Only use URLs supplied by
      knowledge, the product catalog, or tool results.
- [x] Filter private pages before giving the model a source URL:
      - add `/orders`, `/order`, `/my-orders`, `/my-account`, `/my/` (and
        any equivalent account routes) to the crawler skip patterns in
        `services/api/src/knowledge/crawler.ts`
      - also filter at query time for stale documents that are already
        ingested, until a re-crawl replaces them
- [ ] Optional (only if the first tests show missing/invented links): add a
      structured `sources` payload from `answer_knowledge` and render a
      "Sources" row in the widget. This guarantees the links exist independently
      of model wording, but is a larger protocol/widget change.

Implementation (2026-10-28):

- New `services/api/src/knowledge/source-links.ts` validates crawled page URLs
  and owns the shared private-path list used by the crawler and query filter.
- `queryKnowledge` now returns `{ text, score, title, url }`; crawled documents
  only get a URL when `crawlJobId` is set and `fileName` is a public http(s) URL.
- `formatKnowledgeHits` in `services/api/src/chat/knowledge-result.ts` emits the
  source line; tests cover URLs, file names, private pages and formatting.
- `answer_knowledge` uses `minScore: 0.45`; short navigation pages such as
  `/about` scored 0.465 and were dropped by the old 0.5 default. The five-hit
  limit keeps the lower threshold from flooding the model.
- Existing crawled `/orders` content is filtered from queries immediately.
  The crawler will stop ingesting it on the next crawl.
- No widget source changed; no database migration. Absolute links were already
  handled by both renderers.

### Widget

No required change for Phase 1: absolute links already render in both
surfaces. Verify:

- [ ] Sleek: `WidgetMarkdown` renders the source URL as an anchor.
- [ ] Classic/Glow: `renderMd` renders the same anchor in the Shadow DOM.
- [ ] `apps/web/public/widget.js` is regenerated if `helpers.js` or any
      Classic/Glow source changes (`pnpm --filter web build:widget`).

### Acceptance

- [x] Ask "Do you have an About page?" and get a clickable
      `https://www.urbanplusgh.com/about` link (or the exact crawled URL).
      Live smoke test 2026-10-28 returned
      `[About | Urban+](https://www.urbanplusgh.com/about)`.
- [ ] Ask about a private/account page; the reply does not offer a link to it.
      Direct query checks confirm `/orders` and `/my/orders` are filtered, but
      the live reply was blocked by a provider outage during the check.
- [ ] No response links to an invented `urban-plus-2.com`-style URL.
- [ ] Payment/booking links still open the portal correctly.
- [ ] Uploaded-document answers do not fabricate a source URL.

### Size

Small: knowledge query, tool-result formatting, prompt, skip patterns, tests.

---

## 6. Phase 2 — Product page links (medium; migration)

This is the "Open" button from `plan/product-card-plan.md` §2, with the
missing data plumbing made concrete.

### 6.1 Data model

- [x] Add nullable `productUrl` (`product_url`) to the `products` table in
      `packages/database/src/schema/products.ts`.
- [x] Generate and apply a Drizzle migration in `packages/database/drizzle/`.
      `0031_product_url.sql` is hand-written because the drizzle journal is
      already inconsistent; it has been applied to Neon.
- [x] Validate `productUrl` as `http(s)` only, max 2,000 chars, at every
      write boundary (create, update, data-source sync). Private/account
      routes, credentials, and Convex storage URLs are rejected too.
- [ ] Backfill existing products where the owner/data source can supply a URL.
      No confirmed URL source exists yet; owners can enter one, and a later
      data-source sync fills it when the source has a URL column.

### 6.2 Owner UI and API

- [x] Add a "Product page URL" field to
      `apps/web/components/dashboard/create-product-button.tsx`.
- [x] Add the same field to `apps/web/components/dashboard/edit-product-sheet.tsx`
      and its `EditableProduct` type.
- [x] Include the field in product create/update Zod schemas and API routes.

### 6.3 Data-source mapping

- [x] Extend `ProductColumnMapping`, `MappedProduct`, and `mapProductRow` in
      `services/api/src/datasources/product-columns.ts` with a URL column.
      Prefer full URL columns (`url`, `product_url`, `product_page`, `link`,
      `permalink`); do not treat a bare slug as a complete URL.
- [ ] If a source only has a slug/handle, add a domain `websiteUrl` or a
      product-URL pattern and construct the absolute URL explicitly. Confirm
      the canonical pattern before using it (for Urban Plus, the existing plan
      guesses `.../products/<slug>` but that is unconfirmed). Not implemented
      because no canonical pattern is confirmed.
- [x] Update `upsertSyncedProducts` in
      `services/api/src/datasources/server.ts`:
      - include `productUrl` when the source supplies one
      - do not overwrite a manually entered URL with `null` when a later sync
        has no URL column
- [x] Handle Convex product records whose URL may be stored as a slug,
      storage ID, or plain string. Only accept values that resolve to a real
      `http(s)` page URL; never turn an image storage ID into a page URL.

### 6.4 Chat/API types

- [x] Add `productUrl?: string | null` to `AgentProduct` in
      `packages/widget-core/src/types.ts`.
- [x] Include `productUrl` in `getProductCatalog` in
      `services/api/src/chat/server.ts`; the catalog also drops unsafe legacy
      values before they reach the prompt or widget.
- [x] Include it in the public config payload returned by
      `handleChatConfig` so Classic/Glow and Sleek both receive it.
- [x] Include the product URL in the system-prompt catalog line so the model
      can refer to the product page in prose as well as through the card.
- [x] Add the URL to the product share text when present
      (`shareProduct` in `apps/web/components/widget/chat-widget.tsx`).

### 6.5 Widget

Modern Sleek:

- [x] Add a "View product" action in `ProductView`
      (`apps/web/components/widget/chat-widget.tsx`), next to Share/Image.
      Open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- [x] For popup-blocker fallback, copy the URL when opening fails or show the
      URL so the visitor can open it manually. Do not silently do nothing.
      The action is a native anchor, so there is no programmatic popup that can
      be blocked.
- [x] Keep the card itself opening the viewer (avoids nested interactive
      elements and preserves the existing UX).
- [x] If the "View product" action makes the action row too crowded on mobile,
      move it above Share/Image as the primary action. It is above the row.

Classic/Glow:

- [x] In `_appendProductCard` (`apps/web/widget/engine.js`), when
      `product.productUrl` is a safe absolute URL, wrap the card content in an
      anchor or add a small "View product" link. No nested interactive
      elements; keep the existing image/name/price layout. A small link is
      appended below the price.
- [x] Regenerate `apps/web/public/widget.js` and let `lint` verify it is
      current.

### Acceptance

- [ ] A product with a URL shows "View product" and opens the exact page.
      Code paths are in place; live visual check remains pending.
- [ ] A product without a URL shows no action and no dead link. Code paths are
      in place; live visual check remains pending.
- [x] The product URL survives a data-source re-sync. The upsert uses
      `coalesce(excluded.product_url, products.product_url)` and the generated
      SQL was checked.
- [x] Invalid/scheme-unsafe URLs are rejected at save/import. Tests cover
      relative, `javascript:`, credential-bearing, private, and storage URLs.
- [x] Share text includes the product URL when available.
- [x] Classic/Glow and Sleek both link correctly. Both renderers validate the
      URL and use `target="_blank"` with `rel="noopener noreferrer"`.

Implementation (2026-10-28):

- `services/api/src/products/url.ts` is the single server-side validator:
  absolute `http(s)`, no credentials, no private/account paths, no Convex
  storage URLs, max 2,000 chars enforced by the Zod schemas.
- Product forms send the field through the existing create/update routes;
  `EditableProduct`, the dashboard list types, and the page mapping carry it.
- Data-source sync maps full URL columns only; `upsertSyncedProducts` preserves
  an existing URL when the source row has none. Bare slugs are never guessed.
- `getProductCatalog` drops unsafe legacy URLs before the system prompt or
  config payload sees them. Sleek and Classic/Glow also validate at render time.
- Sleek adds a full-width native anchor above Share/Image; Classic/Glow appends
  a small "View product" link under the price. Both avoid nested interactives.
- Tests cover URL-column selection, mapping, rejection cases, and the prompt
  catalog line. `public/widget.js` is rebuilt and lint checks it is current.
- Not done: backfilling existing products and slug-to-URL construction, because
  no canonical product URL source/pattern is confirmed. Live widget visual
  checks are still pending.

### Size

Medium: migration, product forms/API, source mapping, type propagation,
two widget surfaces, tests.

---

## 7. Phase 3 — Optional: relative links and links inside pages

Only after Phases 1–2 are live.

- [ ] Add `websiteUrl` to `domains` (or use the latest crawl job URL) and pass
      it to the system prompt.
- [ ] Resolve relative page/product URLs server-side against `websiteUrl`
      before they reach the model or widget. Keep the renderers absolute-only.
- [ ] Preserve links found inside crawled pages:
      - either append a compact "Links on this page: [text](absolute-url)"
        section to the ingested text, or
      - store a `links` JSON column on `knowledgeDocuments` and return relevant
        links with the knowledge hit.
      Prefer the structured column if the appended text would bloat chunks.
- [ ] Add sitemap.xml support for sites whose product pages are not present in
      crawlable `<a href>` links (current Urban Plus crawl found only five
      pages, likely because product links are client-rendered).
- [ ] Consider a known-URL allowlist: crawled page URLs + product URLs +
      tool-generated portal URLs. Only links in that set become clickable
      inline. This is the only way to make "correct link" a hard guarantee.

---

## 8. Security and correctness guardrails

- Keep the existing `http(s)`/`mailto` allowlist in
  `apps/web/lib/widget-markdown.ts` (`isSafeLinkUrl`) and
  `apps/web/widget/helpers.js` (`isMdSafeUrl`).
- Validate owner-supplied product URLs on the server; never trust the client.
- Never link `javascript:`, `data:`, `file:`, or credentials in URLs.
- Keep `target="_blank"` + `rel="noopener noreferrer"`.
- Do not link uploaded knowledge files as if they were public pages.
- Do not expose dashboard, portal-token, payment-token, or internal API URLs
  unless they are the intended visitor destination.
- Filter private/account pages both at crawl time and at answer time.
- Treat model-generated URLs as untrusted. The prompt rule is a quality
  measure, not a security boundary.
- Preserve the existing payment/booking links; they are generated by tools and
  are already correct.

---

## 9. Test plan

### Unit

- [ ] Knowledge query returns `url`/`title` with hits; returns no URL for
      uploaded files.
- [ ] `answer_knowledge` formatting includes the exact source URL and title.
- [ ] Crawler skips `/orders` and similar private routes.
- [ ] Product URL validation accepts full `http(s)` URLs and rejects unsafe
      schemes.
- [ ] Product column mapping detects full URL columns and does not treat a
      slug as a URL.
- [ ] Sync preserves a manual product URL when the source has none.
- [ ] Markdown renderer tests still cover absolute links and unsafe schemes;
      add relative-link tests only if Phase 3 changes the renderer.

### Integration / manual

- [ ] Ask a page question; click the link in both Sleek and Classic/Glow.
- [ ] Ask for a product; open the viewer and click "View product".
- [ ] Test a product without a URL; ensure no action appears.
- [ ] Test a private page; ensure it is not offered.
- [ ] Test inside the cross-origin Sleek iframe; confirm the new tab opens the
      store, not the Ziyarn app.
- [ ] Test with an uploaded document; confirm no fake URL.
- [ ] Confirm payment and booking links still work.

---

## 10. Suggested work order

1. **Phase 1 page links** — backend query/tool/prompt/skip patterns + tests.
   This uses data that already exists and can ship without a migration.
2. **Phase 2 product URL data** — schema, migration, forms, validation, sync.
3. **Phase 2 product UI** — Sleek viewer action, Classic/Glow card link, share
   text.
4. **Phase 3 hardening** — relative URL base, crawled-link preservation,
   sitemap support, known-URL allowlist if needed.

---

## 11. Open questions

- Should the product card itself navigate to the store page, or keep opening
  the in-widget viewer with a "View product" action? Recommendation: keep the
  viewer.
- Are product pages always on the business's own domain, or can they point to
  an external marketplace? Recommendation: allow any valid `http(s)` URL.
- Do we add a domain `websiteUrl` now, or only when relative URLs/sitemap work
  begins? Recommendation: add it in Phase 2/3, not Phase 1.
- Do we want a separate "Sources" strip under answers, or are inline links
  enough? Recommendation: inline first; add the strip if model links are
  unreliable.
- Should Classic/Glow product cards become links, or stay visual-only?
  Recommendation: link them when a URL exists; otherwise keep current behavior.
