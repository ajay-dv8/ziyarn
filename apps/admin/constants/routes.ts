/**
 * Admin panel paths, named once.
 *
 * Admin is a separate Next app — it has its own `app/` tree and its own
 * `/api/auth` mount — so it cannot import `apps/web/constants/routes`. These
 * two files are meant to look alike; keep them that way.
 *
 * Values are paths, never URLs, and never carry a query string. Query params
 * (`page`, `search`, `plan`, `status`, `returnTo`) are built at the call site,
 * because one baked-in variant is what leads the next caller into adding a
 * second `?`.
 *
 * `DOMAIN` and `USER` take an id and are the only non-string entries; every
 * other value is a plain path.
 */
export const ADMIN_ROUTES = {
  HOME: "/admin",
  USERS: "/admin/users",
  /** The `[userId]` child of USERS. */
  USER: (userId: string) => `/admin/users/${userId}`,
  DOMAINS: "/admin/domains",
  /** The `[domainId]` child of DOMAINS. */
  DOMAIN: (domainId: string) => `/admin/domains/${domainId}`,
  WORKSPACES: "/admin/workspaces",
  CONVERSATIONS: "/admin/conversations",
  REVENUE: "/admin/revenue",
  /**
   * Not under /admin: signing in cannot require an admin session, and /setup
   * has to be reachable when no admin exists yet.
   */
  SIGN_IN: "/sign-in",
  SETUP: "/setup",
} as const;

/**
 * The admin HTTP surface. Two handlers is the whole of it.
 *
 * Better Auth serves the auth endpoints and `authClient` knows their paths and
 * methods, so nothing here should be written by hand: sign-out in particular is
 * a POST, and an `<a href>` to it 404s without ending the session. Reach for
 * the client (`authClient.signOut()`), which is what components/sign-out-button
 * does.
 */
export const ADMIN_API_ROUTES = {
  /** The mount itself: `app/api/auth/[...all]`. Better Auth owns all of it. */
  auth: "/api/auth",
  setup: "/api/admin/setup",
} as const;

/**
 * Better Auth's rate-limit rule keys are relative to its mount point, so these
 * cannot use ADMIN_API_ROUTES.auth-prefixed paths. Kept here because they are
 * still routes, not arbitrary strings.
 */
export const ADMIN_AUTH_RATE_LIMIT_PATHS = {
  signInEmail: "/sign-in/email",
  requestPasswordReset: "/request-password-reset",
  resetPassword: "/reset-password",
} as const;
