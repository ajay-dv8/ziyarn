# Knowledge Base Expansion Plan

## Overview

Two new knowledge source types for the AI agent:
1. **Website Crawler** — crawl a site, extract page content, embed as knowledge
2. **Database Connector** — connect to a user's DB, identify relevant tables, embed schema + sample data as knowledge

Both feed into the existing answer_knowledge tool pipeline (chunk -> embed -> similarity search).

---

## Feature 1: Website Crawler

### Flow

1. User enters a URL on the knowledge page
2. System validates the URL (must be reachable)
3. Crawler starts BFS from the URL, following internal links
4. Each page: extract text, skip non-content pages (login, admin, payments)
5. Each page becomes a knowledge document with chunks + embeddings
6. User sees crawl progress and results

### Sensible limits

| Limit | Value | Rationale |
|---|---|---|
| Max pages | 50 | Covers most small-medium sites |
| Max depth | 3 | Homepage -> category -> detail page |
| Rate limit | 1 request/second | Avoid hammering the server |
| Skip patterns | /login, /admin, /cart, /checkout, /api, /wp-admin | Non-content pages |
| File types | HTML only | Skip PDFs, images, downloads |
| Timeout | 10s per page | Don't hang on slow pages |

### Database schema

New table: crawl_jobs

- id UUID PRIMARY KEY
- agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE
- url TEXT NOT NULL
- status TEXT NOT NULL DEFAULT pending (pending | running | completed | failed)
- pages_found INTEGER DEFAULT 0
- pages_crawled INTEGER DEFAULT 0
- error TEXT
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()

Modify: knowledge_documents — add optional crawl_job_id FK to link crawled pages to their job.

### New files

| File | Purpose |
|---|---|
| services/api/src/knowledge/crawler.ts | Crawler logic: BFS, fetch, extract links, respect limits |
| services/api/src/knowledge/crawler-schemas.ts | Zod schemas for crawl config |
| apps/web/app/api/knowledge/crawl/route.ts | POST to start crawl, GET for status |
| apps/web/components/dashboard/website-crawl-form.tsx | UI: URL input, start button, progress |

### Crawler logic (crawler.ts)

Function crawlWebsite(config) with startUrl, agentId, maxPages (default 50), maxDepth (default 3).

Algorithm:
1. Initialize queue with [{ url: startUrl, depth: 0 }]
2. Initialize visited set
3. While queue not empty and pagesCrawled < maxPages:
   a. Dequeue next URL
   b. Skip if visited, wrong domain, matches skip patterns
   c. Fetch page (10s timeout, follow redirects)
   d. Extract text from HTML (reuse existing extractFileText for HTML type)
   e. Extract all a href links, resolve relative URLs
   f. Filter to same domain, add new links to queue at depth+1
   g. Call ingestContent(agentId, text, pageTitle, { fileName: url })
   h. Increment pagesCrawled
4. Return summary

### API routes

POST /api/knowledge/crawl — body: { domainId, agentId, url } -> { crawlJobId }
GET /api/knowledge/crawl?id=... -> { status, pagesFound, pagesCrawled }

### UI: website-crawl-form.tsx

- Card section below the file upload on the knowledge page
- URL input field + "Start crawl" button
- While crawling: shows progress (pages crawled / found)
- On completion: list of crawled pages with delete buttons
- Errors shown inline

---

## Feature 2: Database Connector

### Concept

Connect to the user's database, introspect the schema, identify tables relevant to customer-facing queries (products, bookings, rooms, pricing, availability), extract sample data, and embed everything as knowledge.

### Flow

1. User enters connection details (host, port, database, user, password)
2. System tests the connection
3. System introspects: lists all tables with columns, types, row counts
4. System analyzes tables to identify which are relevant (heuristic + naming patterns)
5. User reviews and confirms which tables to include
6. System extracts sample rows (first 10 rows or representative sample)
7. Generates a "database schema document" per table and embeds it

### Database schema

New table: data_sources

- id UUID PRIMARY KEY
- agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE
- type TEXT NOT NULL (postgres | mysql | mongodb)
- host TEXT NOT NULL
- port INTEGER NOT NULL
- database_name TEXT NOT NULL
- username TEXT NOT NULL
- password_encrypted TEXT NOT NULL (encrypted at rest)
- status TEXT DEFAULT pending (pending | connected | failed)
- last_synced_at TIMESTAMPTZ
- created_at TIMESTAMPTZ DEFAULT NOW()

New table: data_source_tables

- id UUID PRIMARY KEY
- data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE
- table_name TEXT NOT NULL
- columns JSONB NOT NULL [{ name, type, nullable }]
- row_count INTEGER
- included BOOLEAN DEFAULT true
- sample_data JSONB (first 5-10 rows as JSON)
- created_at TIMESTAMPTZ DEFAULT NOW()

### Table relevance heuristics

| Pattern | Examples |
|---|---|
| Product/catalog | products, items, inventory, catalog, menu |
| Booking/reservation | bookings, reservations, appointments, rooms |
| Pricing | prices, pricing, rates, tariffs, plans |
| Availability | availability, slots, schedule, calendar |
| Categories | categories, types, departments, sections |
| Orders/transactions | orders, transactions, purchases, invoices |
| Reviews | reviews, ratings, testimonials |
| FAQ/content | faq, questions, answers, help, support |

Tables matching these patterns are auto-selected. User can toggle any table on/off.

### Database drivers

| DB | npm package | Notes |
|---|---|---|
| PostgreSQL | pg (node-postgres) | Already available (Neon uses it) |
| MySQL | mysql2 | Need to install |
| MongoDB | mongodb | Need to install, different introspection |

### Introspection queries

PostgreSQL:
- List tables: SELECT table_name FROM information_schema.tables WHERE table_schema = public AND table_type = BASE TABLE
- Get columns: SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1
- Row count: SELECT count(*) FROM $1
- Sample: SELECT * FROM $1 LIMIT 10

MySQL:
- Same pattern but add table_schema = DATABASE() filter

MongoDB:
- db.listCollections(), db.collection.find().limit(10), db.collection.countDocuments()

### Knowledge document format

For each included table, generate a structured knowledge document containing: table name, columns with types, row count, sample data rows, and a description of what the table contains and when to use it.

### New files

| File | Purpose |
|---|---|
| services/api/src/knowledge/data-source.ts | DB connection, introspection, table analysis |
| services/api/src/knowledge/data-source-schemas.ts | Zod schemas for connection config |
| services/api/src/knowledge/drivers/postgres.ts | PostgreSQL driver |
| services/api/src/knowledge/drivers/mysql.ts | MySQL driver |
| services/api/src/knowledge/drivers/mongodb.ts | MongoDB driver |
| apps/web/app/api/knowledge/data-source/route.ts | CRUD for data sources |
| apps/web/app/api/knowledge/data-source/test/route.ts | Test connection |
| apps/web/app/api/knowledge/data-source/sync/route.ts | Re-sync tables |
| apps/web/components/dashboard/database-connect-form.tsx | UI: connection form + table selection |

### Security

- Passwords encrypted at rest using AES-256 with a server-side key
- Read-only database user recommended (documented in UI)
- All queries are SELECT-only, never writes
- Connection tested before saving
- Connection details never exposed to the browser

### UI: database-connect-form.tsx

- Card section below the website crawl on the knowledge page
- Connection form: type dropdown (PostgreSQL/MySQL/MongoDB), host, port, database, username, password
- "Test connection" button
- After successful connection: table list with checkboxes (auto-selected by relevance)
- Each table shows: name, column count, row count, relevance indicator
- "Sync selected tables" button
- Shows last synced time and re-sync option

---

## Implementation order

1. Website Crawler (simpler, self-contained)
   - Add crawl_jobs table + crawl_job_id column on knowledge_documents
   - Build crawler service
   - Add API routes
   - Add UI component
   - Wire into knowledge page

2. Database Connector (more complex, needs drivers + security)
   - Add data_sources + data_source_tables tables
   - Build driver abstraction + PostgreSQL driver first
   - Add MySQL and MongoDB drivers
   - Build introspection + table relevance analysis
   - Add API routes
   - Add UI component with connection form + table selection
   - Wire into knowledge page
   - Encrypt credentials at rest

## Shared considerations

- Both features create knowledge documents that feed into the existing answer_knowledge tool
- Both need progress indicators (crawling / syncing can take time)
- Both should support re-sync (re-crawl or re-introspect)
- Both should show their documents in the existing documents list
- The answer_knowledge tool already handles similarity search — no changes needed there
