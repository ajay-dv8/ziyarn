# Ziyarn Documentation Site Plan

## Executive Summary

Build a comprehensive, searchable documentation site embedded directly in the web app at `/docs`. Uses **Fumadocs** (MDX-based docs framework for Next.js App Router) for built-in search, sidebar navigation, and code highlighting. Docs stay close to the codebase and deploy with the main app.

---

## Architecture Decision: Attached to Web App

### Why Not a Separate App?

| Factor | Separate `apps/docs` | Attached `/docs` in `apps/web` |
|--------|---------------------|-------------------------------|
| Deployment | Extra Vercel project | Single deploy with web |
| Design system | Must share manually | Instant access to `@repo/ui` |
| Sync with features | Manual coordination | Update docs in same PR |
| Navigation | Separate header/nav | Consistent with marketing site |
| Auth context | Re-implement or ignore | Already available |
| Maintenance | 2 apps to maintain | 1 app |

**Decision:** Attach to `apps/web` as a `/docs` route group with its own layout.

### Why Fumadocs?

- Built for Next.js App Router (uses Server Components natively)
- Built-in full-text search (no external service needed)
- MDX with code syntax highlighting (Shiki)
- Sidebar generation from frontmatter
- Tabs, callouts, code blocks, API docs components
- Active community, well-maintained

---

## Route Structure

```
apps/web/app/docs/
├── layout.tsx                    # Docs layout (sidebar + top nav)
├── page.tsx                      # /docs — Landing / overview
├── getting-started/
│   ├── page.tsx                  # Quick start guide
│   └── installing-widget.mdx     # Widget installation
├── widget/
│   ├── page.tsx                  # Widget overview
│   ├── installation/
│   │   ├── page.mdx              # Installation overview
│   │   ├── html.mdx              # Plain HTML / vanilla JS
│   │   ├── react.mdx             # React / Next.js
│   │   ├── vue.mdx               # Vue / Nuxt
│   │   ├── svelte.mdx            # Svelte / SvelteKit
│   │   ├── angular.mdx           # Angular
│   │   ├── wordpress.mdx         # WordPress / PHP
│   │   └── shopify.mdx           # Shopify
│   ├── configuration.mdx         # All widget data-* attributes
│   ├── styling.mdx               # Theming, colors, custom CSS
│   ├── middleware.mdx             # CSP headers, proxy, firewalls
│   ├── typescript.mdx            # .d.ts file, type safety
│   └── troubleshooting.mdx       # Common issues & fixes
├── database/
│   ├── page.mdx                  # Database integration overview
│   ├── postgres.mdx              # PostgreSQL (Neon, Supabase, etc.)
│   ├── mysql.mdx                 # MySQL (PlanetScale, Railway, etc.)
│   ├── mongodb.mdx               # MongoDB (Atlas, etc.)
│   ├── convex.mdx                # Convex
│   ├── firebase.mdx              # Firestore
│   ├── supabase.mdx              # Supabase (as database, not just hosting)
│   ├── planetscale.mdx           # PlanetScale
│   ├── turso.mdx                 # Turso (LibSQL)
│   ├── duckdb.mdx                # DuckDB
│   └── troubleshooting.mdx       # Connection issues, driver errors
├── domains/
│   ├── page.mdx                  # Creating & managing domains
│   ├── setup.mdx                 # Domain setup walkthrough
│   ├── dns.mdx                   # DNS configuration
│   └── multiple.mdx              # Multi-domain strategies
├── agents/
│   ├── page.mdx                  # AI agents overview
│   ├── creating.mdx              # Creating agents
│   ├── personality.mdx           # System prompts & personality
│   ├── tools.mdx                 # Agent tools & capabilities
│   └── multi-agent.mdx           # Multiple agents per domain
├── knowledge/
│   ├── page.mdx                  # Knowledge base overview
│   ├── websites.mdx              # Crawling websites
│   ├── files.mdx                 # Uploading documents
│   ├── manual.mdx                # Manual knowledge entries
│   ├── integrations.mdx          # Notion, Google Docs, etc.
│   └── best-practices.mdx        # Knowledge base tips
├── products/
│   ├── page.mdx                  # Products overview
│   ├── creating.mdx              # Creating products
│   ├── database-sync.mdx         # Syncing from database
│   ├── pricing.mdx               # Pricing & variants
│   └── chat-selling.mdx          # Selling products via chat
├── campaigns/
│   ├── page.mdx                  # Campaigns overview
│   ├── creating.mdx              # Creating campaigns
│   ├── email.mdx                 # Email campaigns
│   ├── triggers.mdx              # Campaign triggers & automation
│   └── analytics.mdx             # Campaign performance
├── bookings/
│   ├── page.mdx                  # Bookings overview
│   ├── setup.mdx                 # Booking configuration
│   ├── calendar.mdx              # Calendar integration
│   ├── notifications.mdx         # Booking notifications
│   └── public-page.mdx           # Public booking page (/portal/book)
├── customers/
│   ├── page.mdx                  # Customer management
│   ├── tracking.mdx              # Customer tracking
│   └── segments.mdx              # Customer segmentation
├── conversations/
│   ├── page.mdx                  # Conversations overview
│   ├── inbox.mdx                 # Conversation inbox
│   ├── human-handoff.mdx         # Human agent takeover
│   ├── Escalation.mdx            # Escalation rules
│   └── notifications.mdx         # Notification system
├── billing/
│   ├── page.mdx                  # Billing overview
│   ├── plans.mdx                 # Subscription plans
│   ├── stripe.mdx                # Stripe integration
│   ├── paystack.mdx              # Paystack integration
│   └── usage.mdx                 # Usage tracking
├── integrations/
│   ├── page.mdx                  # Integrations overview
│   ├── webhooks.mdx              # Webhook configuration
│   ├── api.mdx                   # REST API reference
│   └── third-party.mdx           # Third-party integrations
├── api-reference/
│   ├── page.mdx                  # API overview
│   ├── authentication.mdx        # API authentication
│   ├── endpoints.mdx             # Endpoint reference
│   └── sdks.mdx                  # SDK & client libraries
├── deployment/
│   ├── page.mdx                  # Deployment overview
│   ├── vercel.mdx                # Vercel deployment
│   ├── self-hosted.mdx           # Self-hosting guide
│   └── docker.mdx                # Docker deployment
└── changelog/
    └── page.mdx                  # Product changelog
```

---

## Content Outline by Section

### 1. Getting Started (5 min read)
- What is Ziyarn?
- 3-step quick start
- Core concepts (domains, agents, knowledge)
- Architecture overview diagram

### 2. Widget Integration (30 min read)
**The most critical documentation section.**

#### Installation Guides (per platform):
- **HTML / Vanilla JS** — `<script>` tag, Shadow DOM, zero dependencies
- **React / Next.js** — `"use client"`, `data-api` attribute, dynamic import
- **Vue / Nuxt** — `<ClientOnly>`, plugin registration
- **Svelte / SvelteKit** — `onMount`, lifecycle hooks
- **Angular** — `CUSTOM_ELEMENTS_SCHEMA`, `afterNextRender`
- **WordPress** — Theme footer, plugin approach, PHP snippet
- **Shopify** — Theme.liquid, Dawn theme, custom sections

#### Configuration Reference:
All `data-*` attributes in a single reference table:
| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-api` | string | — | Backend URL |
| `data-domain` | string | — | Domain ID or slug |
| `data-secret` | string | — | Embed secret |
| `data-color` | string | `#000000` | Primary color (CSS hex) |
| `data-position` | string | `bottom-right` | Widget position |
| `data-greeting` | string | — | Welcome message |

#### Middleware / CSP:
- Content-Security-Policy headers for Next.js, Express, Nginx, Apache
- CORS configuration
- Proxy setup
- Cloudflare Workers

#### TypeScript:
- `.d.ts` file contents
- Global type declarations
- Intellisense setup

### 3. Database Integration (20 min read)
- Supported databases overview
- Connection setup per database type
- Table mapping & field configuration
- `includeProducts` / `includeOrders` toggles
- Test connection & sample data
- Connection troubleshooting (Neon, PlanetScale, etc.)

### 4. Domains (10 min read)
- Creating domains
- Domain settings
- Multiple domains strategy
- DNS configuration (CNAME, A records)
- Custom domains

### 5. AI Agents (15 min read)
- Creating agents
- System prompts & personality
- Model selection (Gemini, OpenAI, etc.)
- Agent tools (product lookup, booking, etc.)
- Multi-agent setup
- Fallback behavior

### 6. Knowledge Base (15 min read)
- Uploading documents (PDF, TXT, MD)
- Crawling websites
- Manual knowledge entries
- Knowledge organization
- Best practices for AI training
- Notion / Google Docs integration

### 7. Products (10 min read)
- Creating products manually
- Syncing from database
- Product variants & pricing
- Image upload
- Selling via chat

### 8. Campaigns (10 min read)
- Creating campaigns
- Email templates
- Triggers & automation
- Campaign analytics
- Unsubscribe management

### 9. Bookings (10 min read)
- Booking setup
- Available hours & slots
- Calendar integration
- Email notifications
- Public booking page
- API integration

### 10. Customers (5 min read)
- Customer list
- Customer details
- Conversation history
- Export

### 11. Conversations (10 min read)
- Inbox management
- Human handoff
- Escalation rules
- Notification system (badge, tab title, toast, browser)
- Search & filters

### 12. Billing (10 min read)
- Subscription plans
- Stripe setup
- Paystack setup (Africa)
- Usage tracking
- Invoice management

### 13. API Reference (20 min read)
- Authentication
- Base URL
- Endpoint reference
- Rate limits
- Error handling
- SDK examples

---

## Technical Implementation

### Dependencies to Add

```bash
pnpm --filter web add fumadocs-ui fumadocs-core fumadocs-mdx
```

### File Structure Changes

```
apps/web/
├── content/docs/                 # MDX files (source of truth)
│   ├── meta.json                 # Sidebar ordering
│   └── (all .mdx files)
├── app/docs/
│   ├── layout.tsx               # Fumadocs layout
│   ├── [[...slug]]/
│   │   └── page.tsx             # Catch-all page renderer
│   └── page.tsx                 # /docs landing
└── lib/
    └── source.ts                # Fumadocs source configuration
```

### Key Implementation Files

1. **`lib/source.ts`** — Fumadocs source config
2. **`app/docs/layout.tsx`** — Docs layout with sidebar
3. **`app/docs/[[...slug]]/page.tsx`** — MDX page renderer
4. **`content/docs/meta.json`** — Sidebar structure
5. **`next.config.js`** — Add `createMDX()` plugin

### Sidebar Structure (meta.json)

```json
{
  "title": "Documentation",
  "pages": [
    "---Getting Started---",
    "getting-started",
    "---Widget---",
    "widget",
    "widget/installation",
    "widget/configuration",
    "widget/styling",
    "widget/middleware",
    "widget/typescript",
    "widget/troubleshooting",
    "---Database---",
    "database",
    "database/postgres",
    "database/mysql",
    "database/mongodb",
    "---Platform---",
    "domains",
    "agents",
    "knowledge",
    "products",
    "---Features---",
    "campaigns",
    "bookings",
    "customers",
    "conversations",
    "---Billing---",
    "billing",
    "---Developer---",
    "integrations",
    "api-reference",
    "deployment",
    "---Updates---",
    "changelog"
  ]
}
```

---

## Content Authoring Workflow

### How to Add/Update Docs

1. Edit MDX file in `apps/web/content/docs/`
2. Frontmatter controls page metadata:

```mdx
---
title: Widget Installation
description: How to add the Ziyarn chat widget to your website
---

# Widget Installation

Your content here...
```

3. Code blocks with syntax highlighting:

````mdx
```html
<script
  data-api="https://your-api.com"
  data-domain="your-domain"
  src="https://ziyarn.vercel.app/widget.js"
></script>
```
````

4. Callouts for important notes:

```mdx
:::note
The `data-color` attribute expects a CSS hex value (`#000000`), NOT Tailwind classes.
:::

:::warning
Never expose your embed secret in client-side code that's publicly accessible.
:::
```

5. Tabs for platform-specific instructions:

```mdx
<Tabs items={["React", "Vue", "Svelte"]}>
  <Tab value="react">
    React content...
  </Tab>
  <Tab value="vue">
    Vue content...
  </Tab>
  <Tab value="svelte">
    Svelte content...
  </Tab>
</Tabs>
```

### Updating Docs When Features Change

- When adding a new `data-*` attribute → update `widget/configuration.mdx`
- When changing API endpoints → update `api-reference/endpoints.mdx`
- When adding a new integration → create new file + update `meta.json`
- When releasing a feature → add entry to `changelog.mdx`

---

## Implementation Phases

### Phase 1: Foundation (1-2 hours)
- [ ] Install Fumadocs dependencies
- [ ] Create `content/docs/` directory structure
- [ ] Configure `lib/source.ts`
- [ ] Create docs layout (`app/docs/layout.tsx`)
- [ ] Create catch-all page renderer
- [ ] Add `createMDX()` to `next.config.js`
- [ ] Create sidebar `meta.json`
- [ ] Verify build works

### Phase 2: Core Content (4-6 hours)
- [ ] Getting Started landing page
- [ ] Widget installation guides (HTML, React, Vue)
- [ ] Widget configuration reference
- [ ] Database integration overview
- [ ] Domain setup guide
- [ ] Agent creation guide

### Phase 3: Feature Documentation (4-6 hours)
- [ ] Knowledge base guides
- [ ] Products documentation
- [ ] Campaigns documentation
- [ ] Bookings documentation
- [ ] Customers & conversations
- [ ] Billing setup

### Phase 4: Developer Docs (2-3 hours)
- [ ] API reference
- [ ] Webhook documentation
- [ ] Deployment guides
- [ ] TypeScript / `.d.ts` reference
- [ ] Middleware / CSP guides

### Phase 5: Polish (1-2 hours)
- [ ] Search verification
- [ ] Mobile responsiveness check
- [ ] Link checker
- [ ] Changelog page
- [ ] OpenGraph images for social sharing

---

## Maintenance

### When to Update Docs

| Trigger | Action |
|---------|--------|
| New `data-*` attribute | Update `widget/configuration.mdx` |
| New API endpoint | Update `api-reference/endpoints.mdx` |
| New database driver | Create `database/<name>.mdx` |
| New integration | Create `integrations/<name>.mdx` |
| Bug fix in widget | Update `widget/troubleshooting.mdx` |
| New feature launch | Add to relevant section + `changelog.mdx` |
| Breaking change | Add migration guide + `changelog.mdx` |

### Documentation Standards

1. **Every public feature must have documentation**
2. **Code examples must be copy-pasteable** — no `// ...` placeholders
3. **Test all code examples** before publishing
4. **Include error messages** in troubleshooting sections
5. **Use consistent terminology** — match UI labels exactly
6. **Screenshots** for visual features (widget, dashboard)

---

## Success Metrics

- [ ] All 14 dashboard features documented
- [ ] Widget installation for 7+ platforms
- [ ] Database integration for 8+ databases
- [ ] API reference complete
- [ ] Search works across all content
- [ ] Mobile-friendly documentation
- [ ] < 30 seconds to find any answer
