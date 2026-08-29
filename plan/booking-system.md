# Booking System — Implementation Plan

## Overview
Add a full booking/appointment system to Ziyarn: availability configuration, AI-aware slot checking, dashboard management, and future manual booking support.

## Decisions
- **Availability scope:** Per-domain (all agents share one schedule)
- **Minimum notice:** Configurable, default 24 hours
- **AI behavior:** Check availability when visitor suggests a time (not proactive listing)
- **Slot uniqueness:** Domain + date + time (extended with schedule validation)

---

## Progress

### Phase 1: Database Schema ✅
- [x] Create `booking_settings` table in `packages/database/src/schema/portal.ts`
- [x] Add `duration` and `timezone` columns to `bookings` table
- [x] Generate migration SQL → `packages/database/drizzle/0021_booking_settings.sql`
- [ ] Apply migration to Neon (manual — network)

### Phase 2: Availability Engine ✅
- [x] Create `services/api/src/portal/availability.ts`
- [x] `getBookingSettings(domainId)` — load or return defaults
- [x] `getAvailableSlots(domainId, date)` — generate available HH:MM slots
- [x] `checkSlotAvailable(domainId, date, time)` — returns specific error codes
- [x] Integrated into `createBooking()` in `portal/server.ts`

### Phase 3: AI Awareness ✅
- [x] Modify system prompt builder in `apps/web/app/api/chat/route.ts`
- [x] Inject availability hours when booking_settings exist for domain
- [x] Update `book_appointment` tool executor to run full availability check
- [x] Return specific error messages (outside hours, slot taken, too soon, too far)

### Phase 4: API Routes ✅
- [x] `GET /api/bookings` — list bookings (owner, paginated, filterable by status)
- [x] `GET /api/bookings/[id]` — booking detail
- [x] `PATCH /api/bookings/[id]` — update status (confirm/cancel)
- [x] `GET /api/booking-settings` — get settings for domain
- [x] `PUT /api/booking-settings` — upsert settings
- [x] `GET /api/booking-settings/slots` — available slots for date

### Phase 5: Service Layer ✅
- [x] `listBookings(domainId, filters)` — paginated list with total count
- [x] `getBooking(id)` — single booking lookup
- [x] `updateBookingStatus(id, status)` — confirm or cancel
- [x] `upsertBookingSettings(domainId, data)` — create/update
- [x] `getBookingSettingsForDomain(domainId)` — get current (or defaults)
- [x] `getAvailableSlotsForDomain(domainId, date)` — available slots
- [x] All exported from `services/api/src/portal/server.ts`

### Phase 6: Dashboard UI ✅
- [x] Add "Bookings" to sidebar nav (`app-sidebar.tsx`) with Calendar icon
- [x] Add `DASHBOARD_BOOKINGS` route constant
- [x] Create `/dashboard/bookings/page.tsx` — bookings list with domain picker
- [x] Create `bookings-table.tsx` component (status badges, confirm/cancel actions)
- [x] Create `booking-settings-form.tsx` component (days, hours, duration, notice)
- [x] Domain picker (same pattern as other pages)
- [x] Status badges (pending/confirmed/cancelled)
- [x] Empty state

### Phase 7: Typecheck + Lint ✅
- [x] `pnpm --filter @repo/api check-types`
- [x] `pnpm --filter web check-types`
- [x] `pnpm --filter @repo/api lint`
- [x] `pnpm --filter web lint`

---

## Files Created
| File | Purpose |
|------|---------|
| `packages/database/drizzle/0021_booking_settings.sql` | Migration |
| `services/api/src/portal/availability.ts` | Availability engine |
| `apps/web/app/api/bookings/route.ts` | List bookings API |
| `apps/web/app/api/bookings/[id]/route.ts` | Booking detail/update API |
| `apps/web/app/api/booking-settings/route.ts` | Settings CRUD API |
| `apps/web/app/api/booking-settings/slots/route.ts` | Available slots API |
| `apps/web/app/dashboard/bookings/page.tsx` | Bookings list page |
| `apps/web/components/dashboard/bookings-table.tsx` | Bookings table |
| `apps/web/components/dashboard/booking-settings-form.tsx` | Settings form |

## Files Modified
| File | Change |
|------|--------|
| `packages/database/src/schema/portal.ts` | Added `booking_settings` table, added `duration`/`timezone` to bookings |
| `services/api/src/portal/server.ts` | Added CRUD functions, availability check in createBooking |
| `services/api/src/portal/schemas.ts` | Added settings zod schema, updateBookingStatus, listBookings |
| `services/api/src/portal/index.ts` | Exported new schemas, types, availability functions |
| `apps/web/app/api/chat/route.ts` | System prompt injection + availability-aware tool executor |
| `apps/web/components/dashboard/app-sidebar.tsx` | Added Bookings nav item |
| `apps/web/constants/routes/routes.ts` | Added `DASHBOARD_BOOKINGS` |

---

## Next Steps
- [ ] Apply migration to Neon when network is available
- [ ] Wire up booking-settings-form `onSave` to `PUT /api/booking-settings` (needs client-side fetch wrapper)
- [ ] Wire up bookings-table `onUpdateStatus` to `PATCH /api/bookings/[id]`
- [ ] Add booking confirmation email triggers in `updateBookingStatus`
- [ ] Add booking analytics to analytics page
- [ ] Visitor-facing booking settings page improvements
