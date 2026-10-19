/**
 * Every route handler under `app/api`, named once.
 *
 * This is the HTTP surface, not the service layer. `@repo/api` (services/api)
 * is the in-process domain logic these handlers call; the two share a word, not
 * a purpose. Do not merge them.
 *
 * Two rules:
 *
 * 1. Paths, never URLs. No query strings live here — they differ per caller
 *    (`domainId`, `agentId`, `page`), and one baked-in variant misleads the next
 *    caller into appending a second `?`.
 * 2. Dynamic segments are functions, not templates. `byId(agentId)` is typed;
 *    `` `${API_ROUTES.agents.root}/${id}` `` is the string building this file
 *    exists to remove, and nothing would check the result.
 *
 * The shape mirrors the URL tree: a node with children is an object, a static
 * leaf is a string, a dynamic leaf is a function. `root` is the collection URL
 * and `byId` is its `/:id` child.
 */
export const API_ROUTES = {
  agents: {
    root: "/api/agents",
    byId: (agentId: string) => `/api/agents/${agentId}`,
  },
  analytics: "/api/analytics",
  auth: {
    /** The mount itself: `app/api/auth/[...all]`. Better Auth owns all of it. */
    root: "/api/auth",
    /**
     * Better Auth's own endpoints, not ours. The app reaches them through
     * `authClient` rather than by hand — these are listed to document the mount,
     * so that nobody invents `/api/auth/sign-in/email` as a literal. If you find
     * yourself writing a fetch to one of them, there is a client method for it.
     */
    signInEmail: "/api/auth/sign-in/email",
    signUpEmail: "/api/auth/sign-up/email",
    /** OAuth redirect prefix. Providers append their id: `/callback/google`. */
    callback: "/api/auth/callback",
    /** POST only, despite looking like a link. */
    signOut: "/api/auth/sign-out",
  },
  billing: {
    checkout: "/api/billing/checkout",
    portal: "/api/billing/portal",
    paystack: {
      cancel: "/api/billing/paystack/cancel",
      initialize: "/api/billing/paystack/initialize",
      reconcile: "/api/billing/paystack/reconcile",
      verify: "/api/billing/paystack/verify",
      /** Called by Paystack, never by us. */
      webhook: "/api/billing/paystack/webhook",
    },
  },
  bookings: {
    root: "/api/bookings",
    byId: (bookingId: string) => `/api/bookings/${bookingId}`,
  },
  bookingSettings: {
    root: "/api/booking-settings",
    slots: "/api/booking-settings/slots",
  },
  campaigns: {
    root: "/api/campaigns",
    send: (campaignId: string) => `/api/campaigns/${campaignId}/send`,
    schedule: (campaignId: string) => `/api/campaigns/${campaignId}/schedule`,
    cancelSchedule: (campaignId: string) =>
      `/api/campaigns/${campaignId}/cancel-schedule`,
    /** Called by the scheduler, never by us. */
    processScheduled: "/api/campaigns/process-scheduled",
  },
  chat: "/api/chat",
  customers: "/api/customers",
  integrations: {
    databases: "/api/integrations/databases",
    stripeConnect: "/api/integrations/stripe-connect",
  },
  invite: {
    accept: "/api/invite/accept",
  },
  knowledge: {
    upload: "/api/knowledge/upload",
    crawl: "/api/knowledge/crawl",
    byId: (documentId: string) => `/api/knowledge/${documentId}`,
    file: (documentId: string) => `/api/knowledge/${documentId}/file`,
  },
  /**
   * Catch-all: `key` is a slash-separated object path (`<userId>/<id>.png`),
   * not a single segment. Do not encodeURIComponent it.
   */
  logos: (key: string) => `/api/logos/${key}`,
  orders: {
    syncDatabase: "/api/orders/sync-database",
  },
  portal: {
    booking: "/api/portal/booking",
    pay: "/api/portal/pay",
  },
  products: {
    root: "/api/products",
    create: "/api/products/new",
    byId: (productId: string) => `/api/products/${productId}`,
    syncDatabase: "/api/products/sync-database",
  },
  public: {
    bookings: "/api/public/bookings",
    bookingSettings: "/api/public/booking-settings",
    bookingSlots: "/api/public/booking-slots",
  },
  settings: {
    root: "/api/settings",
    password: "/api/settings/password",
  },
  uploads: {
    logo: "/api/uploads/logo",
  },
  usage: "/api/usage",
  webhooks: {
    /** Called by Resend, never by us. */
    resend: "/api/webhooks/resend",
    /** Called by Stripe, never by us. */
    stripe: "/api/webhooks/stripe",
  },
  workspace: {
    root: "/api/workspace",
    byId: (workspaceId: string) => `/api/workspace/${workspaceId}`,
    invite: (workspaceId: string) => `/api/workspace/${workspaceId}/invite`,
    inviteById: (workspaceId: string, inviteId: string) =>
      `/api/workspace/${workspaceId}/invites/${inviteId}`,
    memberById: (workspaceId: string, memberId: string) =>
      `/api/workspace/${workspaceId}/members/${memberId}`,
  },
} as const;
