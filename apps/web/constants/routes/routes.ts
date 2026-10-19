/**
 * Page paths, named once.
 *
 * The definition lives in `@repo/routes` — `@repo/api` and `@repo/widget-core`
 * build the same URLs and cannot import an app. This file is kept as the import
 * path the app already uses (`@/constants/routes`), so the move needs no
 * call-site changes.
 */
export { APP_ROUTES } from "@repo/routes";
