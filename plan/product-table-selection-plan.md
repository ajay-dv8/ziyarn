# Per-Table Product Selection for Database Sync

## Overview

Currently `syncProducts` auto-scans **every** table in each connected database
and imports any table whose columns look product-shaped (detectable name +
price columns). Users have no control over which tables feed the catalog.

This plan adds a second per-table flag — `includeProducts` — alongside the
existing knowledge-base `included` flag, with a two-checkbox UI on the
Integrations page.

## Decisions (already confirmed)

- **Auto-suggest**: tables that pass `mapProductColumns()` start pre-checked
  for product syncing when a data source is first connected.
- **Separate triggers**: "Save & sync" on Integrations refreshes knowledge
  only; product syncing stays triggered from the Products page button.
- **Deselect semantics**: deselecting a previously synced table stops
  refreshing its products; on the next product sync those products are marked
  `"No longer in source"` (inactive). The UI shows a warning hint about this.

---

## 1. Migration `0019_include_products`

File: `packages/database/drizzle/0019_include_products.sql` (generate via
drizzle-kit, then apply manually with the node script pattern splitting on
`--> statement-breakpoint`; drizzle-kit generate may pick up unrelated diffs —
strip stray statements like it did for user_settings in 0015).

```sql
ALTER TABLE "data_source_tables"
  ADD COLUMN "include_products" boolean DEFAULT false NOT NULL;
```

Verify afterwards:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'data_source_tables' AND column_name = 'include_products';
```

Update the meta snapshot is handled by drizzle-kit generate (journal entry).

## 2. Schema type

`packages/database/src/schema/index.ts` → `dataSourceTables` gains:

```ts
includeProducts: boolean("include_products").notNull().default(false),
```

## 3. Schemas (`services/api/src/datasources/schemas.ts`)

Extend `updateDataSourceTablesSchema` selections:

```ts
selections: z
  .array(
    z.object({
      tableName: z.string().trim().min(1).max(200),
      included: z.boolean().optional(),
      includeProducts: z.boolean().optional(),
    }),
  )
  .min(1)
  .max(500)
```

Add `.refine` per item: at least one of `included` / `includeProducts` must be
present (`data.included !== undefined || data.includeProducts !== undefined`).

## 4. Service (`services/api/src/datasources/server.ts`)

### connect()
When inserting `dataSourceTables` rows:

```ts
const mapping = mapProductColumns(table.columns);
// ...
relevant: isRelevantTable(table.name),
included: isRelevantTable(table.name),
includeProducts: mapping !== null,
```

Import `mapProductColumns` from `./product-columns` (self-reference import:
`@repo/api/datasources/product-columns` — repo rule: no relative imports in
shared packages).

### list()
Per-table response adds:

```ts
includeProducts: dataSourceTables.includeProducts,
productEligible: mapProductColumns(table.columnsJson as ColumnList | null) !== null,
```

(`columnsJson` is stored jsonb; cast defensively.)

### updateTables()
For each selection, patch only provided flags:

```ts
const patch: { included?: boolean; includeProducts?: boolean } = {};
if (selection.included !== undefined) patch.included = selection.included;
if (selection.includeProducts !== undefined) patch.includeProducts = selection.includeProducts;
await db.update(dataSourceTables).set(patch).where(and(...));
```

### syncProducts()
Replace the scan-all-tables flow:

1. Load selected tables once per source:

```ts
const selected = await db
  .select({ tableName: dataSourceTables.tableName })
  .from(dataSourceTables)
  .where(and(
    eq(dataSourceTables.dataSourceId, source.id),
    eq(dataSourceTables.includeProducts, true),
  ));
```

2. If `selected.length === 0`, push `{ label, imported: 0, error: "no product tables selected" }`
   and continue to next source (do NOT run vanish-deactivation for skipped sources).
3. Still call `driver.listTables()` once (fresh columns), but iterate only
   tables whose names are in the selected set.
4. Upsert + vanish logic unchanged (seenKeys accumulates across SELECTED
   tables only; deactivation runs per source after processing).

Edge case preserved: deselecting a previously synced table means its keys no
longer appear in seenKeys → its products are deactivated on next run. This is
intentional (see Decisions) and surfaced via UI hint.

## 5. API route

`apps/web/app/api/products/sync-database/route.ts` — no changes needed (still
POST `{ domainId }`). The PATCH route `/api/integrations/databases` passes new
fields through automatically via schema.

## 6. UI (`apps/web/components/dashboard/database-integration-card.tsx`)

Types:

```ts
type SourceTable = {
  tableName: string;
  rowCount: number | null;
  relevant: boolean;
  included: boolean;
  includeProducts: boolean;   // NEW
  productEligible: boolean;   // NEW (computed server-side)
};
```

Checklist becomes a small grid with two checkbox columns and header labels:

```
            Knowledge | Products
 [x] products        [x]        [x]
 [x] bookings        [x]        [ ]  <- disabled if !productEligible
 [ ] payments        [ ]        [ ]
```

Behaviour:
- Knowledge checkbox binds to existing `included` state (unchanged).
- Products checkbox binds to new state; `disabled={!table.productEligible}`.
- When a user UNchecks Products on a table that previously had it checked
  (i.e., it was synced before), show inline hint under the checklist:
  "Deselected tables' synced products will be marked unavailable on the next
  product sync." (Track "was previously checked" from initial load state.)
- Save & sync PATCHes both flags together.
- Keep the note that product sync itself runs from the Products page button
  ("Sync database products").

## 7. Verification plan

1. Typecheck + lint: `pnpm --filter @repo/api check-types && lint`,
   `pnpm --filter web check-types && lint`.
2. Live E2E through dev server (user runs it):
   - PATCH selections: only `products` has `includeProducts: true`;
     `payments`/`bookings` false (prevents the payments.amount false-positive
     observed earlier).
   - POST `/api/products/sync-database` → expect imported rows only from
     chosen tables.
   - GET products → confirm no new non-selected-table entries.
   - Re-PATCH adding another eligible table → sync again → new rows appear.
   - Deselect all → sync → synced products become inactive with availability
     "No longer in source".
3. Confirm knowledge sync unaffected: PUT `/api/integrations/databases`
   still respects `included` flag independently.

## 8. Commit split (when approved)

Individual commits, dependency order:

1. feat(db): add include_products flag to data_source_tables (+ migration)
2. feat(api): support per-table product selection in datasource service
3. feat(web): two-column knowledge/product table selection UI
4. (optional) fix/chore: clean stale duplicate test products

## Files touched

| File | Change |
|---|---|
| `packages/database/drizzle/0019_*.sql` | new migration |
| `packages/database/drizzle/meta/*` | journal + snapshot |
| `packages/database/src/schema/index.ts` | column |
| `services/api/src/datasources/schemas.ts` | selections shape |
| `services/api/src/datasources/server.ts` | connect/list/updateTables/syncProducts |
| `apps/web/components/dashboard/database-integration-card.tsx` | two checkboxes + hints |

No commits until explicitly instructed.
