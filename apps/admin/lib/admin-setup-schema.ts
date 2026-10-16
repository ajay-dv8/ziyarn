import { z } from "zod";

export const adminSetupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(200),
  /**
   * Protects a freshly deployed instance. Someone who finds the panel before
   * the founder does must not be able to claim the owner role.
   */
  bootstrapSecret: z.string().trim().min(16, "Bootstrap secret is required"),
});

export type AdminSetupInput = z.infer<typeof adminSetupSchema>;