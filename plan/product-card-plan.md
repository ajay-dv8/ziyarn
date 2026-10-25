# Product Card & Commerce Plan

How visitors see (and later reach) the owner's products from inside the widget
chat. Ships today as **vertical cards → fullscreen viewer → share/download**;
the **Open** and **Buy** buttons are deliberately deferred and specified here so
they can be implemented later without re-deriving the design.

Extends `plan/widget-variants-plan.md` (Modern Sleek surface) and depends on the
payment-rail decision in `todo/p0-remaining.md` (P0.7) for the **Buy** phase.

---

# 1 Shipped now (Phase 1 — this change)

| Piece | Where | Notes |
|---|---|---|
| Vertical product card | `apps/web/components/widget/chat-widget.tsx` (`ProductCard`) | Image on top (`aspect-4/3`, object-cover), name + formatted price below. Whole card opens the viewer. |
| Card carousel | same (`AssistantMessage`) | A reply carrying several products renders a horizontal snap carousel; one product renders a single card. |
| Fullscreen viewer | same (`ProductView`) | Full-viewport overlay (fixed in embed mode so it covers the whole screen the iframe owns; absolute in demo/preview so it stays inside the preview surface). Big image, name, price, description, Share + Download image, close (X / Escape). |
| Share | `shareProduct()` helper | Native share sheet (`navigator.share`) with the image file when the device supports file sharing; falls back to sharing the product text; no Share API → copies the product info. |
| Download image | `downloadProductImage()` helper | Fetches the image as a blob and downloads it (Convex storage answers CORS with the widget origin). Falls back to opening the image in a new tab. |
| Description in payload | `packages/widget-core/src/types.ts`, `services/api/src/chat/server.ts` | `AgentProduct.description` (from the owner's catalog) feeds the viewer. Already-public data — the model already sees the catalog. |

Accessibility: the card is a real button (no nested-button HTML — the share
control is a sibling layered above); the viewer is a labelled `role="dialog"`,
Escape closes it before the chat's own Escape-to-close, focus moves to the
close button on open, all icon buttons have accessible names.

Widget file (`apps/web/public/widget.js`) is untouched — Classic/Glow keep
their current (no product card) behavior.

# 2 Phase 2 — Open button (link to the product page)

Take the visitor to the product's own page on the owner's site so they can buy
or read details there.

- [ ] Add `productUrl` (`text`, nullable) to the `products` table
      (`packages/database/src/schema/products.ts`) + drizzle migration.
- [ ] Source the URL per datasource:
  - Convex driver (`services/api/src/datasources/drivers/convex.ts`): map a
    product page/slug field from the customer's table. Urban Plus must expose
    its product URLs (structure: `urbanplusgh.com/products/<slug>` — confirm
    with the client where the canonical URL lives).
  - Other datasources map their own URL field ("url", "link",
    "product_url", …) like the image mapping column selection already works.
  - Ziyarn-managed products: server-side action collecting the URL from the
    owner (dashboard edit field).
- [ ] Surface `productUrl` through `getProductCatalog` → config payload →
      `AgentProduct.productUrl` (nullable; `undefined` = no button).
- [ ] UI: an "Open" button in the fullscreen viewer (nothing on the small card
      — one tap opens the viewer, the viewer owns actions). Opens in a new tab
      (`target="_blank" rel="noopener noreferrer"`); inside a cross-origin
      iframe this navigates the top context only if allowed — new tab avoids
      popups-permission surprises on most browsers. Concierge note: opening a
      new tab on a host-embedded iframe can be blocked by strict popup
      blockers; mitigations: the button doubles as a copyable link if blocked
      (copy the URL as a fallback and tell the user).
- [ ] Share text gains the product URL when present (so sharing includes a
      deep link, not just name + price).

**Done when:** a visitor can open any product that has a URL and land on the
real product page; products without a URL show no Open button.

# 3 Phase 3 — Buy button (checkout in the widget)

Let the visitor buy a purchasable product without leaving the chat. Deliberately
deferred until the payment rail decision lands:

- [ ] Resolve P0.7 rail decision (Paystack subaccount/splits is the leading
      option for GHS customers; see `todo/p0-remaining.md`).
- [ ] Data model: `purchasable boolean` + payment linkage on `products`
      (rail-specific: subaccount code / product mapping), or derive
      purchasability from the domain having a live/paystack subaccount
      configured — decide with the rail.
- [ ] Flow (chat): Buy → widget calls the existing `create_payment` pipeline
      scoped to that product (amount = priceCents, currency, product reference
      in metadata) → returns a payment link the widget opens as an in-iframe
      overlay or a new tab → Paystack popup/redirect → webhook confirms →
      portal shows the order. No new processor; reuse the subscription webhook
      plumbing patterns.
- [ ] Guardrails: one click = one re-keyed payment link (no repeated charges),
      rate-limited by the existing visitor limiter; the agent must not invent
      prices — every Buy call carries the catalog row's priceCents.
- [ ] Shows only on platforms/configs where the rail is live; hide otherwise
      (same gating pattern as `widgetVariant`).

**Done when:** a test purchase completes end to end from the widget with the
order visible in the owner's dashboard.

# 4 Non-goals

- Classic/Glow keep their simple card behavior (no viewer) until the shell is
  unified on the React surface.
- No order storage/cart system in Phase 1–2: Buy (Phase 3) produces a single
  product payment link, not a cart.
