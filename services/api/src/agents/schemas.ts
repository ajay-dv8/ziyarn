import { z } from "zod";

export const agentToolsSchema = z.enum([
  "capture_email",
  "book_appointment",
  "create_payment",
  "escalate",
  "answer_knowledge",
]);

export const agentIdSchema = z.object({
  id: z.string().uuid("Invalid agent id"),
});

export const createAgentSchema = z.object({
  domainId: z.string().uuid("Invalid domain id"),
  name: z
    .string()
    .trim()
    .min(1, "Agent name is required")
    .max(100, "Agent name must be at most 100 characters"),
  description: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(4000).optional(),
  systemPrompt: z.string().trim().max(16000).optional(),
  tools: z.array(agentToolsSchema).max(10).optional(),
});

export const updateAgentSchema = z
  .object({
    name: createAgentSchema.shape.name.optional(),
    description: createAgentSchema.shape.description.optional(),
    instructions: createAgentSchema.shape.instructions.optional(),
    systemPrompt: createAgentSchema.shape.systemPrompt.optional(),
    tools: createAgentSchema.shape.tools.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.instructions !== undefined ||
      data.systemPrompt !== undefined ||
      data.tools !== undefined,
    { message: "Nothing to update" },
  );

export type AgentTools = z.infer<typeof agentToolsSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentIdInput = z.infer<typeof agentIdSchema>;
