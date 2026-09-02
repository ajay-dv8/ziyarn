# Plan 2: Business Types + Dashboard Customization

## Overview

Add a `businessType` field to domains so the dashboard adapts its labels,
system prompts, and page visibility to the user's industry. Designed to be
easy to extend with new types later.

---

## Business Types

| Key | Label | Tagline |
|-----|-------|---------|
| (null) | Generic | Default fallback |
| education | Education | Schools, courses, and training |
| health | Health & Pharmacy | Clinics, pharmacies, and wellness |
| ecommerce | E-Commerce | Online stores and retail |
| hospitality | Hotels & Hospitality | Hotels, resorts, and travel |
| food | Food & Restaurants | Restaurants, catering, and delivery |
| finance | Banking & Finance | Banks, fintech, and advisory |

---

## Architecture: Business Type Config

All per-type customization lives in ONE config file. Adding a new type = adding
one entry to this config. No other files need to change.

**File:** `services/api/src/domains/business-types.ts`

```ts
export type BusinessType =
  | "education"
  | "health"
  | "ecommerce"
  | "hospitality"
  | "food"
  | "finance";

export type PageLabels = {
  products: string;       // e.g. "Courses", "Services", "Menu Items"
  productsPlural: string; // e.g. "Courses", "Services", "Menu Items"
  orders: string;         // e.g. "Enrollments", "Prescriptions", "Orders"
  customers: string;      // e.g. "Students", "Patients", "Customers"
  bookings: string;       // e.g. "Consultations", "Appointments", "Reservations"
};

export type BusinessTypeConfig = {
  label: string;
  tagline: string;
  labels: PageLabels;
  defaultSystemPrompt: string;
  defaultTools: string[];
  showBookings: boolean;
  showProducts: boolean;
  showOrders: boolean;
};

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeConfig> = {
  education: {
    label: "Education",
    tagline: "Schools, courses, and training",
    labels: {
      products: "Course",
      productsPlural: "Courses",
      orders: "Enrollments",
      customers: "Students",
      bookings: "Consultations",
    },
    defaultSystemPrompt:
      "You are an academic advisor and enrollment assistant for this educational institution. " +
      "Help prospective and current students with course selection, enrollment, schedules, " +
      "prerequisites, tuition, and financial aid. Be warm, encouraging, and knowledgeable. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  health: {
    label: "Health & Pharmacy",
    tagline: "Clinics, pharmacies, and wellness",
    labels: {
      products: "Service",
      productsPlural: "Services",
      orders: "Prescriptions",
      customers: "Patients",
      bookings: "Appointments",
    },
    defaultSystemPrompt:
      "You are a patient care coordinator and pharmacy assistant for this healthcare provider. " +
      "Help patients with appointment scheduling, medication inquiries, service information, " +
      "insurance questions, and general health guidance. Be compassionate, professional, and " +
      "never provide medical diagnoses. Always recommend consulting a healthcare professional. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  ecommerce: {
    label: "E-Commerce",
    tagline: "Online stores and retail",
    labels: {
      products: "Product",
      productsPlural: "Products",
      orders: "Orders",
      customers: "Customers",
      bookings: "Bookings",
    },
    defaultSystemPrompt:
      "You are a friendly sales and support assistant for this online store. " +
      "Help visitors find products, answer questions about pricing, shipping, returns, " +
      "and guide them toward making a purchase. Be concise, honest, and helpful. " +
      "Never invent product details you are unsure about. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "create_payment",
      "sell_product",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: false,
    showProducts: true,
    showOrders: true,
  },
  hospitality: {
    label: "Hotels & Hospitality",
    tagline: "Hotels, resorts, and travel",
    labels: {
      products: "Package",
      productsPlural: "Packages",
      orders: "Reservations",
      customers: "Guests",
      bookings: "Bookings",
    },
    defaultSystemPrompt:
      "You are a front desk concierge for this hospitality business. " +
      "Help guests with room availability, reservations, amenities, local recommendations, " +
      "check-in/check-out, and special requests. Be warm, welcoming, and attentive. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "sell_product",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  food: {
    label: "Food & Restaurants",
    tagline: "Restaurants, catering, and delivery",
    labels: {
      products: "Menu Item",
      productsPlural: "Menu Items",
      orders: "Orders",
      customers: "Customers",
      bookings: "Reservations",
    },
    defaultSystemPrompt:
      "You are a helpful restaurant assistant for this food business. " +
      "Help customers with menu inquiries, orders, reservations, catering requests, " +
      "dietary restrictions, delivery options, and special promotions. Be friendly, " +
      "knowledgeable about the menu, and patient with dietary questions. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "sell_product",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  finance: {
    label: "Banking & Finance",
    tagline: "Banks, fintech, and advisory",
    labels: {
      products: "Product",
      productsPlural: "Products",
      orders: "Applications",
      customers: "Clients",
      bookings: "Consultations",
    },
    defaultSystemPrompt:
      "You are a financial services assistant for this institution. " +
      "Help customers with account inquiries, product information, loan applications, " +
      "investment options, interest rates, and general financial guidance. Be professional, " +
      "precise, and security-conscious. Never share account-specific information without " +
      "proper authentication. Never provide personalized financial advice. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
};

/** Returns config for the given type, or generic defaults if null/undefined. */
export function getBusinessTypeConfig(
  type: BusinessType | null | undefined,
): BusinessTypeConfig {
  return (type && BUSINESS_TYPES[type]) ?? GENERIC_CONFIG;
}

/** Generic fallback when no business type is set. */
export const GENERIC_CONFIG: BusinessTypeConfig = {
  label: "Generic",
  tagline: "Sales and support assistant",
  labels: {
    products: "Product",
    productsPlural: "Products",
    orders: "Orders",
    customers: "Customers",
    bookings: "Bookings",
  },
  defaultSystemPrompt:
    "You are a friendly sales and support assistant for this business. " +
    "Help visitors with their questions, qualify their interest, and move them " +
    "toward booking a call or buying. Be concise, honest and helpful. " +
    "Never invent company facts you are unsure about. " +
    "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
  defaultTools: [
    "capture_email",
    "book_appointment",
    "create_payment",
    "sell_product",
    "answer_knowledge",
    "escalate",
  ],
  showBookings: true,
  showProducts: true,
  showOrders: true,
};
```

---

## Phase 1: Database Schema Changes

### Step 1.1 — Add `businessType` column to domains

**File:** `packages/database/src/schema/domains.ts`

Add after `logoUrl`:

```ts
businessType: text("business_type", {
  enum: [
    "education",
    "health",
    "ecommerce",
    "hospitality",
    "food",
    "finance",
  ],
}),
```

Nullable — null means "generic" (default).

### Step 1.2 — Generate migration

```bash
cd packages/database && pnpm exec drizzle-kit generate
```

If it hangs, apply SQL manually:
```sql
ALTER TABLE domains ADD COLUMN business_type text;
```

---

## Phase 2: Business Type Config

### Step 2.1 — Create config file

**New file:** `services/api/src/domains/business-types.ts`

(Contents shown above in Architecture section.)

### Step 2.2 — Export from domains module

**File:** `services/api/src/domains/index.ts`

Add exports:
```ts
export {
  BUSINESS_TYPES,
  GENERIC_CONFIG,
  getBusinessTypeConfig,
  type BusinessType,
  type BusinessTypeConfig,
  type PageLabels,
} from "@repo/api/domains/business-types";
```

---

## Phase 3: API Changes

### Step 3.1 — Domain creation schema

**File:** `services/api/src/domains/schemas.ts`

Add `businessType` to `createDomainSchema`:
```ts
businessType: z.enum([
  "education", "health", "ecommerce",
  "hospitality", "food", "finance",
]).optional(),
```

### Step 3.2 — Domain update schema

**File:** `services/api/src/domains/schemas.ts`

Add `businessType` to `updateDomainSchema`:
```ts
businessType: z.enum([
  "education", "health", "ecommerce",
  "hospitality", "food", "finance",
]).optional().nullable(),
```

### Step 3.3 — Domain creation service

**File:** `services/api/src/domains/server.ts`

In `createDomain()`, store the business type:
```ts
businessType: input.businessType ?? null,
```

### Step 3.4 — Chat system prompt

**File:** `apps/web/app/api/chat/route.ts`

Replace the hardcoded `DEFAULT_SYSTEM_PROMPT` with business-type-aware prompt.

When assembling the system prompt, look up the domain's `businessType` and use
`getBusinessTypeConfig(domain.businessType).defaultSystemPrompt` instead of the
generic default.

This only applies when the agent does NOT have a custom `systemPrompt` set.

---

## Phase 4: UI — Domain Settings

### Step 4.1 — Business type in domain creation

**File:** `apps/web/components/domains/create-domain-form.tsx`

Add a dropdown after the slug field:
```
Business Type (optional)
[Select your industry ▾]
  • Generic (default)
  • Education
  • Health & Pharmacy
  • E-Commerce
  • Hotels & Hospitality
  • Food & Restaurants
  • Banking & Finance
```

### Step 4.2 — Business type in domain settings

**File:** `apps/web/app/dashboard/domains/[domainId]/page.tsx`

Add a "Business Type" section below the name/slug fields. Show current type
with an edit button to change it.

---

## Phase 5: UI — Dynamic Sidebar Labels

### Step 5.1 — Sidebar component

**File:** `apps/web/components/dashboard/app-sidebar.tsx`

The sidebar currently has hardcoded labels (Products, Orders, Customers, Bookings).
Change to dynamic labels based on the selected domain's `businessType`.

The sidebar receives the domain list from the layout. The selected domain's
`businessType` determines the labels:

```ts
import { getBusinessTypeConfig } from "@repo/api/domains";

// Inside the component, for the selected domain:
const config = getBusinessTypeConfig(selectedDomain?.businessType);
const labels = config.labels;

// Then use labels.products, labels.orders, labels.customers, labels.bookings
```

### Step 5.2 — Layout passes businessType

**File:** `apps/web/app/dashboard/layout.tsx`

Ensure the `businessType` field is included when fetching domains. The layout
already fetches domains — just make sure `businessType` is in the select.

---

## Phase 6: UI — Dynamic Page Titles

Each page currently has a hardcoded title and description. Update them to
use the business type config.

### Step 6.1 — Products page

**File:** `apps/web/app/dashboard/products/page.tsx`

```ts
const config = getBusinessTypeConfig(selectedDomain?.businessType);
// Title: `${config.labels.productsPlural}` instead of "Products"
// Description adapts: "Catalog your {labels.productsPlural.toLowerCase()}..."
```

### Step 6.2 — Orders page

**File:** `apps/web/app/dashboard/orders/page.tsx`

```ts
const config = getBusinessTypeConfig(selectedDomain?.businessType);
// Title: config.labels.orders instead of "Orders"
```

### Step 6.3 — Customers page

**File:** `apps/web/app/dashboard/customers/page.tsx`

```ts
const config = getBusinessTypeConfig(selectedDomain?.businessType);
// Title: config.labels.customers instead of "Customers"
```

### Step 6.4 — Bookings page

**File:** `apps/web/app/dashboard/bookings/page.tsx`

```ts
const config = getBusinessTypeConfig(selectedDomain?.businessType);
// Title: config.labels.bookings instead of "Bookings"
```

### Step 6.5 — Overview page

**File:** `apps/web/app/dashboard/page.tsx`

Update quick-action links and stat labels to use dynamic names.

---

## Phase 7: UI — Page Visibility

Some pages don't make sense for certain business types.

### Step 7.1 — Sidebar hide logic

**File:** `apps/web/components/dashboard/app-sidebar.tsx`

For e-commerce, hide the "Bookings" link. For other types, show all links.

```ts
const config = getBusinessTypeConfig(selectedDomain?.businessType);

// In the sidebar items array, filter:
if (!config.showBookings) {
  items = items.filter(item => item.route !== "/dashboard/bookings");
}
```

### Step 7.2 — Redirect hidden pages

**File:** `apps/web/app/dashboard/bookings/page.tsx` (and others)

Add a server-side redirect if the domain's business type hides this page.
Or simply show a "This page is not available for your business type" message.

---

## Phase 8: Agent Defaults

### Step 8.1 — Agent creation

**File:** `apps/web/components/dashboard/create-agent-button.tsx`

When creating an agent, pre-fill the description with a business-type-specific
placeholder:

```
Education: "Tell us about your institution..."
Health: "Tell us about your practice or clinic..."
E-Commerce: "Tell us about your store..."
Hospitality: "Tell us about your property..."
Food: "Tell us about your restaurant..."
Finance: "Tell us about your firm..."
```

### Step 8.2 — Default tools per type

When creating an agent for a domain with a business type, pre-select the
default tools from `getBusinessTypeConfig(type).defaultTools`.

---

## Phase 9: Extensibility

Adding a new business type in the future requires changes to ONLY:

1. **`services/api/src/domains/business-types.ts`** — add one entry to
   `BUSINESS_TYPES` and the `BusinessType` union type
2. **`packages/database/src/schema/domains.ts`** — add the new value to the
   `business_type` enum (or leave as nullable text to avoid migration)

The config-driven design means no other files need to change. The sidebar,
pages, system prompts, and tools all read from the config automatically.

---

## Phase 10: Verification

1. Typecheck: `pnpm --filter @repo/api check-types && pnpm --filter web check-types`
2. Lint: `pnpm --filter @repo/api lint && pnpm --filter web lint`
3. Test: create domain with "education" type → verify sidebar shows "Courses", "Enrollments", "Students"
4. Test: create domain with "food" type → verify sidebar shows "Menu Items", "Orders", "Customers"
5. Test: create domain with no type → verify generic labels appear
6. Test: change business type on existing domain → verify labels update
7. Test: verify system prompt uses business-type-specific preamble
8. Test: verify e-commerce hides Bookings page

---

## File Checklist

### New files (1)
- `services/api/src/domains/business-types.ts`

### Modified files (14)
- `packages/database/src/schema/domains.ts`
- `packages/database/drizzle/0025_business_type.sql` (generated)
- `services/api/src/domains/schemas.ts`
- `services/api/src/domains/server.ts`
- `services/api/src/domains/index.ts`
- `apps/web/app/api/chat/route.ts`
- `apps/web/components/dashboard/app-sidebar.tsx`
- `apps/web/components/domains/create-domain-form.tsx`
- `apps/web/app/dashboard/domains/[domainId]/page.tsx`
- `apps/web/app/dashboard/products/page.tsx`
- `apps/web/app/dashboard/orders/page.tsx`
- `apps/web/app/dashboard/customers/page.tsx`
- `apps/web/app/dashboard/bookings/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/dashboard/create-agent-button.tsx`
