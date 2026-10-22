/**
 * Widget variant registry — the single source of truth for which widgets exist.
 *
 * Mirrors the PLAN_LIMITS pattern in services/api/src/plans/server.ts: one list,
 * read by the dashboard picker, the embed snippet generator and the public
 * config endpoint. Every variant also has a matching entry in the widget
 * runtime's own VARIANTS map. Never declare a variant name in feature code.
 *
 * Adding a widget is ONE row here. It also needs sources under apps/web/widget/
 * and an id in VARIANTS in apps/web/scripts/build-widget.mjs. Modern Sleek is
 * delivered by that same script, which mounts its iframe from
 * apps/web/app/embed/[slug] — no database migration, because the column is
 * plain text precisely so this list can grow.
 */
export const WIDGET_VARIANTS = [
  {
    id: "classic",
    label: "Classic",
    description: "Floating chat bubble in the corner of the page",
  },
  {
    id: "glow",
    label: "Glow",
    description: "Aurora panel with a thinking orb while it answers",
  },
  {
    id: "sleek",
    label: "Modern Sleek",
    description:
      "Centered glass card with live tool activity, opened in a full-screen iframe",
  },
] as const;

export type WidgetVariantId = (typeof WIDGET_VARIANTS)[number]["id"];

export const DEFAULT_WIDGET_VARIANT: WidgetVariantId = "classic";

export function isWidgetVariant(value: unknown): value is WidgetVariantId {
  return WIDGET_VARIANTS.some((variant) => variant.id === value);
}

/**
 * Normalises anything into a valid variant id.
 *
 * Fail open: an unknown name, an empty string, or null all resolve to the
 * default. A typo in an embed snippet must never leave a paying customer's
 * website with a blank chat widget.
 */
export function resolveWidgetVariant(value: unknown): WidgetVariantId {
  if (typeof value !== "string") return DEFAULT_WIDGET_VARIANT;
  const normalized = value.trim();
  return isWidgetVariant(normalized) ? normalized : DEFAULT_WIDGET_VARIANT;
}

export function widgetVariantLabel(value: unknown): string {
  const id = resolveWidgetVariant(value);
  return WIDGET_VARIANTS.find((variant) => variant.id === id)?.label ?? id;
}

/** Ids for the widget runtime, in picker order. */
export const WIDGET_VARIANT_IDS = WIDGET_VARIANTS.map((variant) => variant.id);