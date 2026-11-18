# Dashboard access from the customer's CMS

Status: Phases 1–2 implemented; Phases 3–4 proposed
Last updated: 2026-11-18

Assumption: WordPress is the first optional CMS target. Phase 1 is
platform-independent and ships regardless; Phase 3 changes if the customer base
is Shopify, Webflow, or a custom admin.

## Goal

Give a Ziyarn customer a link they can put in their own CMS/admin menu, so
clicking it opens the Ziyarn dashboard for the right domain. The link uses the
normal Ziyarn sign-in; it is not a new authentication method.

The first release is a copyable, domain-scoped URL. A small WordPress plugin is
the optional second step for customers who want a real admin menu item instead of
a pasted link or bookmark.

## Non-goals

- A CMS, page builder, or website editor inside Ziyarn.
- A link in the visitor-facing chat widget. The widget is public; the dashboard
  link is for the site owner and staff only.
- Magic-link or token-in-URL auto-login. That needs a separate security design.
- A Shopify, Webflow, Wix, or Squarespace app. Those platforms need their own
  extension model and are deferred.
- A universal "inject a link into any CMS" feature. Ziyarn cannot modify an
  arbitrary admin area.
- Tracking every click. A referral parameter can be added later if it earns its
  keep.

## Decisions

1. **Universal copyable link first.** It works on every platform and is the
   fallback even after a plugin exists.
2. **The link targets the domain overview:**
   `/dashboard/domains?domainId=<domain-id>`. No new route and no database
   change. The page already resolves `domainId` and redirects to the domain list
   if the domain is stale or deleted.
3. **The link contains no secret.** A domain UUID is an identifier, not a bearer
   token. The dashboard still requires a session and performs the existing
   workspace and ownership checks.
4. **Normal sign-in, not auto-login.** If the owner is signed in, the link lands
   on the domain. If not, they sign in and can return to the link. A `next`
   redirect is a later enhancement, not a prerequisite.
5. **WordPress gets the first optional plugin** if it is a meaningful part of
   the customer base. It is a tiny admin-menu plugin, not an API integration.
6. **Do not use iframes.** Embedding the dashboard in a CMS admin panel breaks
   cookies, CSP, and framing assumptions and adds no value over a link.

## Current state

- `apps/web/app/dashboard/domains/page.tsx` already treats `?domainId=` as the
  selected domain's Overview tab. An unknown ID redirects to
  `APP_ROUTES.DASHBOARD_DOMAINS`.
- `apps/web/components/domains/embed-snippet.tsx` is the install surface. It
  already has the domain's `widgetUrl` and a copy pattern, and it is rendered
  both on the single-domain overview and on each card in the domain list.
- `apps/web/components/team/copy-link-button.tsx` is a reusable client-side copy
  button with an accessible `aria-label` and a short "Copied" state.
- `APP_ROUTES.DASHBOARD_DOMAINS` is `/dashboard/domains`; query parameters are
  built at the call site by convention.
- There is no WordPress plugin and no CMS-specific integration.
- The dashboard is server-protected by the dashboard layout and the domain
  service. A copied URL alone exposes nothing.
- The active workspace is a cookie. `listDomains` only returns domains in that
  workspace, so a domain link can redirect to the list if the browser's active
  workspace is different. This is acceptable for v1; see "Known limitations".

## Implementation notes

- Phase 1 shipped 2026-11-18:
  - `EmbedSnippet` now requires `domainId` and renders the domain-scoped
    dashboard URL below the install snippet.
  - Both domain-page usages pass `domainId`.
  - `pnpm --filter web check-types` and `pnpm --filter web lint` pass.
- Phase 2 shipped 2026-11-18:
  - Added **Keep the dashboard handy** to `apps/web/content/docs/widget.mdx`
    with the WordPress must-use plugin recipe, custom-backend instructions, and
    the platform fallback.
  - Added a **How to add this to your site admin** link from the copy block.
  - Typecheck, lint, and the 60 web tests pass.
  - Fetched `/docs/widget` locally and confirmed the
    `#keep-the-dashboard-handy` anchor and setup content render.
- Browser verification of the copied link is still pending; the URL is built
  from the same origin as `widgetUrl`, and the dashboard route already resolves
  `domainId`.

## URL contract

```text
<app-origin>/dashboard/domains?domainId=<domain-id>
```

- `app-origin` is the same origin as the domain's `widgetUrl`.
- `domain-id` is URL-encoded. Domain IDs are UUIDs, so this is normally a no-op.
- Example:
  `https://app.ziyarn.com/dashboard/domains?domainId=8c4f...`
- No embed secret, API key, session token, or user email goes in the URL.
- If a deployment moves to a new host, previously copied links point at the old
  host. A stable branded short domain is a separate infrastructure decision.

## User flow

1. Owner opens **Dashboard → Domains → [Domain]**.
2. In the install card they see **Keep Ziyarn in your site admin** with the
   domain dashboard URL and a copy button.
3. They paste the URL into their CMS admin menu, a bookmark, or their site's
   admin navigation.
4. Clicking it opens Ziyarn:
   - signed in + correct workspace → that domain's Overview;
   - signed in + another workspace → the domain list (known limitation);
   - signed out → sign-in, then the dashboard.

## Phase 1 — Copyable domain dashboard link (implemented)

This is the only phase required to ship the universal feature.

### Changes

1. `apps/web/components/domains/embed-snippet.tsx`
   - Add a required `domainId: string` prop.
   - Build the URL from the existing `embedOrigin`:
     ```ts
     const dashboardUrl = `${embedOrigin}${APP_ROUTES.DASHBOARD_DOMAINS}?domainId=${encodeURIComponent(domainId)}`;
     ```
   - Add a bordered block below the snippet:
     - heading: **Keep Ziyarn in your site admin**
     - one line of help: paste this into the CMS menu or bookmark it
     - the URL in a selectable, wrapping monospace line
     - the existing `CopyLinkButton` with label `dashboard link`
     - optionally make the URL itself a link with `target="_blank"` and
       `rel="noreferrer noopener"` so the owner can test it
   - Keep the block below the existing snippet so the install code remains the
     first thing on the card.
2. `apps/web/app/dashboard/domains/page.tsx`
   - Pass `domainId={domain.id}` in both `EmbedSnippet` usages (single-domain
     Overview and domain-list cards).
3. No API, database, schema, or route changes.

### Accessibility and layout

- The copy button keeps the existing accessible label and copied state.
- The URL must wrap (`break-all` or equivalent) and stay selectable on mobile.
- The heading and help text must make clear this is an admin link, not the
  public widget.

### Verification

- `pnpm --filter web check-types`
- `pnpm --filter web lint`
- In a signed-in browser:
  - copy the link and compare it with the address bar;
  - open it in a new tab and confirm it lands on the same domain's Overview;
  - open it signed out and confirm it goes to sign-in;
  - change the `domainId` to a missing UUID and confirm it redirects to the
    domain list rather than rendering an empty shell;
  - check the block at mobile width.
- Confirm the URL does not contain the embed secret.

## Phase 2 — Setup instructions for the customer's admin (implemented)

### Changes

Add a **Keep the dashboard handy** section to
`apps/web/content/docs/widget.mdx` (or a short new docs page if the section
grows). It should state the limitation clearly: Ziyarn cannot add a menu item to
an arbitrary CMS; the customer adds the link using their platform's own
extension mechanism.

Once the section ships, add a small **How to add this to your site admin** link
next to the copy block in `EmbedSnippet`.

#### WordPress

Offer two recipes:

1. **No-plugin recipe (safe for technical users):** a small
   `wp-content/mu-plugins/ziyarn-dashboard.php` file that registers a top-level
   `Ziyarn` menu item for `manage_options` users and redirects on `admin_init`
   to the copied URL. A must-use plugin survives theme updates, unlike
   `functions.php`. Do not redirect from the menu-page callback: WordPress has
   already started admin output by then, so `wp_redirect()` can fail with
   "headers already sent". Intercept the request before output.
2. **Official plugin:** link to the Phase 3 plugin once it ships.

The snippet must use the copied domain URL, check `manage_options` before the
redirect, and exit after `wp_redirect`. Do not put a secret in the snippet.

Minimal recipe for the docs:

```php
<?php
/**
 * Plugin Name: Ziyarn Dashboard Link
 * Description: Adds a Ziyarn link to the WordPress admin menu.
 */

defined( 'ABSPATH' ) || exit;

const ZIYARN_DASHBOARD_URL = 'PASTE_YOUR_ZIYARN_DASHBOARD_LINK_HERE';
const ZIYARN_DASHBOARD_PAGE = 'ziyarn-dashboard';

function ziyarn_register_dashboard_menu() {
    add_menu_page(
        'Ziyarn',
        'Ziyarn',
        'manage_options',
        ZIYARN_DASHBOARD_PAGE,
        'ziyarn_render_dashboard_fallback',
        'dashicons-format-chat',
        58
    );
}
add_action( 'admin_menu', 'ziyarn_register_dashboard_menu' );

function ziyarn_redirect_to_dashboard() {
    if ( ! isset( $_GET['page'] ) || ZIYARN_DASHBOARD_PAGE !== $_GET['page'] ) {
        return;
    }
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    wp_redirect( ZIYARN_DASHBOARD_URL );
    exit;
}
add_action( 'admin_init', 'ziyarn_redirect_to_dashboard' );

function ziyarn_render_dashboard_fallback() {
    echo '<div class="wrap"><h1>Ziyarn</h1><p><a class="button button-primary" href="' . esc_url( ZIYARN_DASHBOARD_URL ) . '">Open dashboard</a></p></div>';
}
```

The official plugin replaces the constant with a sanitized option and a settings
form.

#### Custom backend

Document the same pattern in plain terms: add a link to the admin navigation
that points at the copied URL. The link can be a normal external link or open a
new tab.

#### Shopify, Webflow, Wix, Squarespace

State that these platforms do not allow arbitrary admin-menu links without an
app. Give the bookmark fallback and defer platform-specific apps until there is
demand.

### Verification

- Docs build succeeds.
- Follow the WordPress snippet on a local or scratch WordPress install.
- Confirm an editor (non-admin) cannot see or use the menu item.
- Confirm the copied URL is the only configuration value; there is no secret.

## Phase 3 — Optional WordPress plugin

Build this only if WordPress is a meaningful customer segment, or at least a
few customers explicitly ask for it. The copyable link in Phase 1 remains the
supported path for everyone else.

### Scope

A dependency-free plugin that adds a **Ziyarn** item to the WordPress admin menu
and opens the configured Ziyarn dashboard URL. It does not install the widget,
store the embed secret, or call the Ziyarn API.

### Files

```text
integrations/wordpress/ziyarn-dashboard/
├── ziyarn-dashboard.php
├── readme.txt
└── assets/
    └── icon.svg          (optional)
```

Keep it outside the pnpm workspace so the Node tooling does not try to build it.

### Behavior

- `add_menu_page()` adds a top-level **Ziyarn** menu for users with
  `manage_options`, with the chat dashicon.
- An `admin_init` handler (before any admin output) catches
  `admin.php?page=ziyarn-dashboard`:
  - valid URL → `wp_redirect()` to it and exit;
  - missing/invalid URL → redirect to the plugin's settings page instead;
  - no `manage_options` → fall through to WordPress's normal permission error.
- Do not redirect from the menu-page callback. WordPress has already started
  admin output by then; use `admin_init` (or the matching `load-` hook) so the
  redirect happens before headers are sent.
- A **Settings** submenu stores one URL:
  - `register_setting()` with a sanitizer that accepts only `http` and `https`;
  - capability check `manage_options`;
  - nonce via the Settings API;
  - escaped output.
- The settings page explains: copy the link from **Ziyarn → Domains →
  [Domain] → Keep Ziyarn in your site admin**, paste it here, save.
- If the URL is blank, the top-level menu must not redirect to an empty target.
- Do not use `wp_safe_redirect()` for an external URL; use `wp_redirect()` with
  the validated, admin-configured value.
- No auto-login, no iframe, no secret. The Ziyarn session is still required.

### Packaging and updates

- Build a zip for manual installation from the plugin directory.
- Publish the zip from the docs or a release artifact; do not commit generated
  binaries to the repo.
- Manual updates are acceptable for v1. Automatic updates would need a release
  server and are out of scope.
- The plugin version must be visible in `readme.txt` and the plugin header.

### Verification

- `php -l integrations/wordpress/ziyarn-dashboard/ziyarn-dashboard.php`
- On a local WordPress install:
  - activate the plugin;
  - confirm the menu appears only for administrators;
  - save a valid URL and confirm the menu opens it;
  - save an invalid scheme and confirm it is rejected;
  - leave the URL blank and confirm the menu opens settings, not an empty page;
  - confirm the plugin does not expose the embed secret or any API key.
- If a WordPress test environment becomes available in CI, add a smoke test for
  the settings save and redirect. Otherwise keep the manual checklist.

## Phase 4 — Deferred: return to the domain after sign-in

This is a UX improvement, not a blocker.

Today the sign-in page redirects an existing session to `/dashboard` and the
forms use `/dashboard` as the social callback. A customer who clicks the CMS
link while signed out reaches the dashboard home after signing in, not the
domain.

If this becomes annoying:

- accept a `next` query parameter on `/sign-in` and `/sign-up`;
- allow only internal paths that start with `/dashboard` and reject `//`,
  schemes, and encoded bypasses;
- pass the validated value as the Better Auth callback URL for email/password
  and OAuth;
- add a test for open-redirect rejection.

Do not add a permanent login token to the CMS link. If true one-click login is
ever required, use a short-lived, single-use signed token generated by a
server-to-server integration and audit it; that is a separate project.

## Rollout

1. Ship Phase 1 and verify with one real domain.
2. Add Phase 2 docs.
3. Measure whether owners actually use the copied link and whether WordPress
   customers ask for a menu item.
4. Build Phase 3 only if the demand is real.
5. Keep the copyable link in the UI even after the plugin exists.

## Success measure

- An owner can go from their site admin to the correct Ziyarn domain in one
  click after setup, or one click plus sign-in if their session expired.
- Fewer "where do I log in?" support questions.
- The feature adds no new secret, API key, or auth bypass.

## Known limitations

- Signed-out users are not returned to the domain after sign-in; see Phase 4.
- If the active workspace cookie points at another workspace, the domain link
  redirects to the domain list. A domain-scoped route that switches workspace
  would fix this but is more than the first version needs.
- Shopify, Webflow, Wix, and Squarespace cannot get an arbitrary admin-menu link
  without a platform app; the copyable link/bookmark is the fallback.
- Moving the app to a new host changes the link. A stable short domain is a
  separate decision.
- The plugin is manually updated and distributed; no auto-update server in v1.

## Open decisions

1. Which CMS is the first target? WordPress is assumed for Phase 3. If most
   customers use Shopify or a custom admin, stop after Phase 1 and write that
   platform's guide instead.
2. Should the plugin be official and downloadable from the Ziyarn dashboard, or
   a documented snippet only? Start with the snippet; promote to a plugin when
   demand is proven.
3. Should the link open the domain Overview or the dashboard home? Overview is
   the default because it is the installed widget's home.
4. Is a branded short link worth it? Defer; use the app origin for now.

## File map

- `apps/web/components/domains/embed-snippet.tsx` — copyable domain dashboard
  link.
- `apps/web/app/dashboard/domains/page.tsx` — pass `domainId` in both usages.
- `apps/web/content/docs/widget.mdx` — WordPress/custom-admin setup guide.
- `integrations/wordpress/ziyarn-dashboard/` — optional plugin (Phase 3).
- `plan/dashboard-access-plan.md` — this plan.

## Acceptance criteria

- A copied link opens the correct domain's Overview for a signed-in owner.
- A copied link never contains the embed secret or a login token.
- The link is visible and copyable on mobile.
- The docs explain WordPress and the generic admin-menu recipe.
- The optional plugin adds a working admin menu item without storing secrets or
  adding an authentication bypass.
