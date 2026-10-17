import { z } from "zod";

import { WIDGET_VARIANT_IDS, type WidgetVariantId } from "@repo/api/domains/widget-variants";

export type { Plan } from "@repo/api/plans";

const businessTypeEnum = z.enum([
  "education",
  "health",
  "ecommerce",
  "hospitality",
  "food",
  "finance",
]);

export { businessTypeEnum };

/**
 * Built from the registry so a new widget needs no schema edit. Unknown values
 * are rejected at the API boundary rather than silently stored — the runtime
 * fallback in widget.js exists for hand-written embed snippets, not for this.
 *
 * z.enum() needs a non-empty tuple, which a plain `.map()` cannot infer, hence
 * the cast. It is a tuple of the registry's own ids, not a hand-written list —
 * the registry stays the single source of truth.
 */
const widgetVariantEnum = z.enum(
  WIDGET_VARIANT_IDS as [WidgetVariantId, ...WidgetVariantId[]],
);

export { widgetVariantEnum };

export const domainNameSchema = z
  .string()
  .trim()
  .min(1, "Domain name is required")
  .max(100, "Domain name must be at most 100 characters");

export const domainSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/,
    "Slug must be 3-63 characters, lowercase letters, digits or hyphens",
  );

export const domainIdSchema = z.object({
  id: z.string().uuid("Invalid domain id"),
});

export const domainLogoUrlSchema = z.url().max(500);

export const createDomainSchema = z.object({
  name: domainNameSchema,
  slug: domainSlugSchema,
  logoUrl: domainLogoUrlSchema.optional().nullable(),
  businessType: businessTypeEnum.optional(),
  widgetVariant: widgetVariantEnum.optional(),
});

export const updateDomainSchema = z
  .object({
    name: domainNameSchema.optional(),
    slug: domainSlugSchema.optional(),
    logoUrl: domainLogoUrlSchema.nullable().optional(),
    businessType: businessTypeEnum.nullable().optional(),
    widgetVariant: widgetVariantEnum.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.slug !== undefined ||
      data.logoUrl !== undefined ||
      data.businessType !== undefined ||
      data.widgetVariant !== undefined,
    { message: "Nothing to update" },
  );

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
export type DomainIdInput = z.infer<typeof domainIdSchema>;
