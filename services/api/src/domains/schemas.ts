import { z } from "zod";

export type { Plan } from "@repo/api/plans";

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

export const createDomainSchema = z.object({
  name: domainNameSchema,
  slug: domainSlugSchema,
});

export const updateDomainSchema = z
  .object({
    name: domainNameSchema.optional(),
    slug: domainSlugSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "Nothing to update",
  });

export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>;
export type DomainIdInput = z.infer<typeof domainIdSchema>;
