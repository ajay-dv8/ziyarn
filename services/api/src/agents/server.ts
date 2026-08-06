import { and, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { agents, domains } from "@repo/database/schema";

import type { SessionWithUser } from "@repo/api/domains/server";
import {
  createAgentSchema,
  updateAgentSchema,
  type CreateAgentInput,
  type UpdateAgentInput,
} from "@repo/api/agents/schemas";

export class AgentServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AgentServiceError";
  }
}

const unauthorized = () =>
  new AgentServiceError(401, "UNAUTHORIZED", "You must be signed in");

const forbidden = () =>
  new AgentServiceError(403, "FORBIDDEN", "You do not own this domain");

const domainNotFound = () =>
  new AgentServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");

const DEFAULT_AGENT_TOOLS = [
  "capture_email",
  "book_appointment",
  "create_payment",
  "sell_product",
  "escalate",
  "answer_knowledge",
] as const;

const agentNotFound = () =>
  new AgentServiceError(404, "AGENT_NOT_FOUND", "Agent not found");

/**
 * Owner-scoped agent CRUD. Agents belong to a domain; every mutation verifies
 * the session user owns the domain before touching the agent.
 */
export function createAgentsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireOwnedDomain = async (
    domainId: string,
    headers: Headers,
  ): Promise<NonNullable<SessionWithUser>> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [domain] = await db
      .select({ id: domains.id, ownerId: domains.ownerId })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);

    if (!domain) throw domainNotFound();
    if (domain.ownerId !== session.user.id) throw forbidden();

    return session;
  };

  const requireOwnedAgent = async (
    domainId: string,
    agentId: string,
    headers: Headers,
  ): Promise<{ id: string }> => {
    await requireOwnedDomain(domainId, headers);

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.domainId, domainId)))
      .limit(1);

    if (!agent) throw agentNotFound();
    return agent;
  };

  return {
    /** Lists agents of a domain owned by the session user. */
    listAgents: async (domainId: string, headers: Headers) => {
      await requireOwnedDomain(domainId, headers);

      return db
        .select()
        .from(agents)
        .where(eq(agents.domainId, domainId))
        .orderBy(agents.createdAt);
    },

    /** Returns a single agent if the session user owns its domain. */
    getAgent: async (domainId: string, agentId: string, headers: Headers) => {
      const agent = await requireOwnedAgent(domainId, agentId, headers);

      const [row] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agent.id))
        .limit(1);
      if (!row) throw agentNotFound();
      return row;
    },

    /** Creates an agent inside a domain owned by the session user. */
    createAgent: async (input: CreateAgentInput, headers: Headers) => {
      const body = createAgentSchema.parse(input);
      await requireOwnedDomain(body.domainId, headers);

      const [created] = await db
        .insert(agents)
        .values({
          domainId: body.domainId,
          name: body.name,
          description: body.description,
          instructions: body.instructions,
          systemPrompt: body.systemPrompt,
          tools: body.tools ?? [...DEFAULT_AGENT_TOOLS],
          filterQuestions: body.filterQuestions ?? null,
        })
        .returning();

      return created;
    },

    /** Updates an agent owned by the session user. */
    updateAgent: async (
      domainId: string,
      agentId: string,
      input: UpdateAgentInput,
      headers: Headers,
    ) => {
      const body = updateAgentSchema.parse(input);
      const agent = await requireOwnedAgent(domainId, agentId, headers);

      const [updated] = await db
        .update(agents)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
          ...(body.instructions !== undefined
            ? { instructions: body.instructions }
            : {}),
          ...(body.systemPrompt !== undefined
            ? { systemPrompt: body.systemPrompt }
            : {}),
          ...(body.tools !== undefined ? { tools: body.tools } : {}),
          ...(body.filterQuestions !== undefined
            ? { filterQuestions: body.filterQuestions }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id))
        .returning();

      return updated;
    },

    /** Deletes an agent owned by the session user. */
    deleteAgent: async (domainId: string, agentId: string, headers: Headers) => {
      const agent = await requireOwnedAgent(domainId, agentId, headers);

      await db.delete(agents).where(eq(agents.id, agent.id));
    },
  };
}

export type AgentsService = ReturnType<typeof createAgentsService>;
