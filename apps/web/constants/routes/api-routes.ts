/**
 * Every route handler under `app/api`, named once.
 *
 * The definition lives in `@repo/routes` — `@repo/widget-core` streams to
 * `/api/chat` and cannot import an app. This file is kept as the import path the
 * app already uses (`@/constants/routes`), so the move needs no call-site
 * changes.
 */
export { API_ROUTES } from "@repo/routes";
