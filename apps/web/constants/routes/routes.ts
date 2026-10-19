/**
 * Page paths, named once.
 *
 * Pair this with `./api-routes.ts`: that file names the HTTP handlers, this one
 * names the pages. Any `/dashboard/...` or `/portal/...` literal in a component
 * is a path that cannot be renamed — it belongs here instead.
 *
 * Values are paths, never URLs. No query strings and no origin: query params
 * differ per caller (`domainId`, `agentId`, `range`), so they are built at the
 * call site.
 */
export const APP_ROUTES = {
  HOME: "/",
  FEATURES: "/features",
  PRICING: "/pricing",
  /** The fumadocs root. The page file is `docs/[[...slug]]`. */
  DOCS: "/docs",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  ACCEPT_INVITE: "/accept-invite",
  ONBOARDING: "/onboarding",
  /** One-click unsubscribe from a campaign email. The token goes in the query. */
  UNSUBSCRIBE: "/unsubscribe",
  DASHBOARD: "/dashboard",
  DASHBOARD_DOMAINS: "/dashboard/domains",
  DASHBOARD_CONVERSATIONS: "/dashboard/conversations",
  DASHBOARD_BILLING: "/dashboard/billing",
  DASHBOARD_BOOKINGS: "/dashboard/bookings",
  DASHBOARD_CAMPAIGNS: "/dashboard/campaigns",
  DASHBOARD_CUSTOMERS: "/dashboard/customers",
  DASHBOARD_ORDERS: "/dashboard/orders",
  DASHBOARD_INTEGRATIONS: "/dashboard/integrations",
  DASHBOARD_TEAM: "/dashboard/team",
  DASHBOARD_PRODUCTS: "/dashboard/products",
  DASHBOARD_AGENTS: "/dashboard/agents",
  DASHBOARD_KNOWLEDGE: "/dashboard/knowledge",
  DASHBOARD_DATABASES: "/dashboard/databases",
  DASHBOARD_ANALYTICS: "/dashboard/analytics",
  DASHBOARD_USAGE: "/dashboard/usage",
  DASHBOARD_SETTINGS: "/dashboard/settings",
  /**
   * Visitor-facing and account-free — reached from booking and payment emails,
   * not from the sidebar. Each one carries its token in the query.
   */
  PORTAL_BOOK: "/portal/book",
  PORTAL_BOOKING: "/portal/booking",
  PORTAL_PAY: "/portal/pay",
} as const;
