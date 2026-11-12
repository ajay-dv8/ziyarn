import { eq } from "drizzle-orm";

import { createEmbedder } from "@repo/ai";
import { EMBEDDING_DIMENSIONS } from "@repo/api/ai";
import { db } from "@repo/database";
import { agents, domains } from "@repo/database/schema";

import { aiConfigService } from "./ai-config-service";
import { aiService } from "./chat-service";

export type AgentEmbedder = {
  embed: (texts: string[]) => Promise<number[][]>;
  model: string;
};

/**
 * Embeddings for one agent, resolved from its domain: BYO embedding model when
 * the domain or account sets one, otherwise the platform model. Resolving per
 * call keeps ingestion and search on the same vector space after a settings
 * change.
 */
export async function resolveEmbedderForAgent(
  agentId: string,
): Promise<AgentEmbedder> {
  const [agent] = await db
    .select({ domainId: agents.domainId, ownerId: domains.ownerId })
    .from(agents)
    .innerJoin(domains, eq(agents.domainId, domains.id))
    .where(eq(agents.id, agentId))
    .limit(1);
  if (!agent) throw new Error("Agent not found");

  const provider = await aiConfigService.resolveEmbeddingForDomain(
    agent.domainId,
    agent.ownerId,
  );
  if (!provider) {
    return { embed: aiService.embed, model: aiService.embeddingModel };
  }

  const embedder = createEmbedder({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    model: provider.model,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return { embed: embedder.embed, model: embedder.model };
}
