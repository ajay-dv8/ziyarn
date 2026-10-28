# Sleek Mobile Fullscreen Chat

* **Author:** ajay-dv8
* **Date:** 2026-10-27

## Overview

The modern Sleek chat widget should always open as a fullscreen chat on phones (viewport width ≤480px). Its top must never go above the visible screen, and the whole unit — message panel plus the composer below it — must never be taller than the visible screen, with the mobile keyboard open or closed. Classic and Glow widgets, tablets, and desktop stay as they are. The "Powered by Ziyarn" line below the composer stays hidden on phones.

## Analysis

The previous attempt failed for a structural reason, not a viewport-math tweak: it set the *message panel* to the full visible height. The composer is a separate element below that panel, so panel plus composer was taller than the screen even with the keyboard down. Inside the iframe the page also kept `min-h-dvh`, which can override the intended height. The keyboard is only visible to the host page; the iframe sees its own box, not the phone.

The reviews agree on these points:

* **The host page owns the geometry.** The glass overlay and the iframe are sized from `window.visualViewport`: `top` is the visible top and `height` is the visible height. This is the only layer that can see the keyboard.
* **The iframe must fill the frame, not measure the phone.** The embed page should use `height: 100%` for `html`, `body`, and `main`, with no `min-h-dvh` and no iframe-side `visualViewport` listener. The current iframe-side effect writes two CSS variables that nothing reads, and it cannot see the phone keyboard.
* **The whole chat unit must fit.** The panel takes the remaining space (`flex: 1`, `min-height: 0`); the composer stays a fixed sibling below it. The page must not add padding that pushes the composer past the frame.
* **Fullscreen is a layout state, not one height class.** At ≤480px in embed mode the outer page padding, card radius, border, and shadow should go; the card becomes the screen. The "Full Screen" toggle becomes meaningless and should be hidden on mobile embed. The close button stays.
* **The change is sleeks-only.** Gate the mobile rules on `mode === "embed"` and keep them out of the shared `base.css` mobile block. Classic and Glow depend on that block today; touching it would change them.
* **The "Powered by Ziyarn" line is already hidden** at ≤480px in the embed page (`sleek-embed.tsx`) and in the shadow variants (`base.css`). This is verification, not new work.

## Goals vs. Non-Goals

**In scope**

* Sleek widget on phones (≤480px), both in the framed overlay and on the standalone `/embed/<slug>` page.
* A fullscreen panel plus composer that fit the visible screen with the keyboard open or closed.
* Edge-to-edge presentation on mobile: no outer padding, card radius, border, or shadow.
* Hide the Full Screen toggle on mobile embed.
* Confirm the mobile "Powered by Ziyarn" line stays hidden.

**Out of scope**

* Classic and Glow styles; tablet and desktop layouts; the dashboard preview and `/widget-preview` demo surfaces.
* Host pages without a mobile viewport meta tag (the ≤480px rules do not match there; documented limitation).
* Landscape phones wider than 480px (treated as tablet by the current breakpoint).
* Safe-area padding beyond the browser's default viewport inset.
* Scroll locking the host page behind the overlay.
* Pinch-zoom edge cases.

## Key Decisions & Staging for Next Steps

1. **One geometry owner:** `engine.js` writes the visual-viewport values; `sleek.css` sizes the overlay from them. The embed page only fills the iframe.
2. **Size the whole unit:** in embed mode at ≤480px, `main` and the chat root are `height: 100%`; the panel is `flex: 1; min-height: 0`; the composer is a fixed-height sibling. No `min-h-dvh` inside the frame.
3. **Delete the dead iframe-side viewport effect** in `sleek-embed.tsx` (two CSS variables with no readers).
4. **Scope the CSS with `mode === "embed"`** and the existing 480px breakpoint. Do not modify `base.css`'s mobile block or the classic/glow panel rules.
5. **Verify on real devices:** iOS Safari and Android Chrome; open with the keyboard down, focus the composer, dismiss the keyboard, rotate. Check that the overlay's top equals the visible top and the whole unit's bottom is at or above the visible bottom.
6. **No widget bundle rebuild is expected** for the React-only change. If `apps/web/widget/` sources change, run `pnpm --filter web build:widget` and lint.

## Risks and Open Questions

* The exact cause of the earlier overflow is inferred from the code shape (panel height plus composer sibling plus `min-h-dvh`), not from a device trace. Measure the failing build on a phone before closing the issue.
* Autofocus in embed mode currently focuses the composer as soon as the chat is ready. On a phone that opens the keyboard immediately. Decide whether that is intended for a fullscreen mobile chat, or whether focus should wait for a tap.
* `public/widget.js` and the `/embed` page deploy separately. A mixed old/new pair must still render; the iframe contract (URL, `ziyarn:ready`, `ziyarn:close`) does not change.
* If the widget later opts into `viewport-fit=cover` for the notch, safe-area padding must go inside the frame and must not increase its height.
