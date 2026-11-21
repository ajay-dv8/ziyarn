import { and, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { agents, domainAgentDefaults } from "@repo/database/schema";

import type { SessionWithUser } from "@repo/api/domains/server";
import {
  findDomainAccess,
  roleCanEditDomainData,
} from "@repo/api/workspaces/access";
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
  new AgentServiceError(
    403,
    "FORBIDDEN",
    "You are not a member of this domain's workspace",
  );

const forbiddenMutation = () =>
  new AgentServiceError(
    403,
    "FORBIDDEN",
    "Viewers can only read this domain",
  );

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
 * Workspace-scoped agent CRUD. Agents belong to a domain; access follows
 * membership in the domain's workspace. Reads are open to every member,
 * writes require owner/admin/member (viewers are read-only).
 */
export function createAgentsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireDomainAccess = async (
    domainId: string,
    headers: Headers,
    mutate = false,
  ): Promise<NonNullable<SessionWithUser>> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const access = await findDomainAccess(db, domainId, session.user.id);
    if (access.kind === "not_found") throw domainNotFound();
    if (access.kind === "forbidden") throw forbidden();
    if (mutate && !roleCanEditDomainData(access.role)) {
      throw forbiddenMutation();
    }

    return session;
  };

  const requireAgentAccess = async (
    domainId: string,
    agentId: string,
    headers: Headers,
    mutate = false,
  ): Promise<{ id: string }> => {
    await requireDomainAccess(domainId, headers, mutate);

    const [agent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.domainId, domainId)))
      .limit(1);

    if (!agent) throw agentNotFound();
    return agent;
  };

  return {
    /** Lists agents of a domain the session user can reach. */
    listAgents: async (domainId: string, headers: Headers) => {
      await requireDomainAccess(domainId, headers);

      return db
        .select()
        .from(agents)
        .where(eq(agents.domainId, domainId))
        .orderBy(agents.createdAt);
    },

    /** Returns a single agent if the session user can reach its domain. */
    getAgent: async (domainId: string, agentId: string, headers: Headers) => {
      const agent = await requireAgentAccess(domainId, agentId, headers);

      const [row] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agent.id))
        .limit(1);
      if (!row) throw agentNotFound();
      return row;
    },

    /**
     * The explicitly chosen widget agent, or null when the domain still uses
     * the oldest agent.
     */
    getDefaultAgentId: async (domainId: string, headers: Headers) => {
      await requireDomainAccess(domainId, headers);

      const [row] = await db
        .select({ agentId: domainAgentDefaults.agentId })
        .from(domainAgentDefaults)
        .where(eq(domainAgentDefaults.domainId, domainId))
        .limit(1);

      return row?.agentId ?? null;
    },

    /** Creates an agent inside a domain the session user can edit. */
    createAgent: async (input: CreateAgentInput, headers: Headers) => {
      const body = createAgentSchema.parse(input);
      await requireDomainAccess(body.domainId, headers, true);

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
          temperature: body.temperature ?? null,
        })
        .returning();

      return created;
    },

    /** Updates an agent in a domain the session user can edit. */
    updateAgent: async (
      domainId: string,
      agentId: string,
      input: UpdateAgentInput,
      headers: Headers,
    ) => {
      const body = updateAgentSchema.parse(input);
      const agent = await requireAgentAccess(domainId, agentId, headers, true);

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
          ...(body.temperature !== undefined
            ? { temperature: body.temperature }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id))
        .returning();

      return updated;
    },

    /** Makes an agent the one the widget talks to. */
    setDefaultAgent: async (
      domainId: string,
      agentId: string,
      headers: Headers,
    ) => {
      const agent = await requireAgentAccess(domainId, agentId, headers, true);

      await db
        .insert(domainAgentDefaults)
        .values({ domainId, agentId: agent.id })
        .onConflictDoUpdate({
          target: domainAgentDefaults.domainId,
          set: { agentId: agent.id, updatedAt: new Date() },
        });
    },

    /** Deletes an agent in a domain the session user can edit. */
    deleteAgent: async (domainId: string, agentId: string, headers: Headers) => {
      const agent = await requireAgentAccess(domainId, agentId, headers, true);

      await db.delete(agents).where(eq(agents.id, agent.id));
    },
  };
}

export type AgentsService = ReturnType<typeof createAgentsService>;
