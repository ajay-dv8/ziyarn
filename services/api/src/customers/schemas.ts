import { z } from "zod";

export const customerSourceSchema = z.enum(["chat", "database", "site"]);

export const listCustomersSchema = z.object({
  domainId: z.uuid(),
  source: customerSourceSchema.optional(),
  q: z.string().trim().max(120).optional(),
});

export const importCustomersSchema = z.object({
  domainId: z.uuid(),
  rows: z
    .array(
      z.object({
        name: z.string().trim().max(200).optional(),
        email: z.string().trim().toLowerCase().email("Invalid email address").max(320),
      }),
    )
    .min(1)
    .max(2000),
});

export const backfillCustomersSchema = z.object({
  domainId: z.uuid(),
});

export const customerBulkSchema = z.object({
  domainId: z.uuid(),
  ids: z.array(z.uuid()).min(1).max(500),
});

export type CustomerSource = z.infer<typeof customerSourceSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
export type ImportCustomersInput = z.infer<typeof importCustomersSchema>;
export type BackfillCustomersInput = z.infer<typeof backfillCustomersSchema>;
export type CustomerBulkInput = z.infer<typeof customerBulkSchema>;

/** Best-effort name column detection for database contact imports. */
export function isEmailColumn(columnName: string): boolean {
  return /e-?mail/i.test(columnName);
}

export function isNameColumn(columnName: string): boolean {
  return /(^|_)name$/i.test(columnName) || /^(full_?name|contact_?name)$/i.test(columnName);
}
