import { z } from "zod";

export const planSchema = z.enum(["free", "standard", "pro", "ultimate", "custom"]);

export type Plan = z.infer<typeof planSchema>;
