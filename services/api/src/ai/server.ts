import { and, eq, isNotNull } from "drizzle-orm";

import type { Database } from "@repo/database";
import { aiConfigs, domainAiConfigs } from "@repo/database/schema";
import { domains } from "@repo/database/schema/domains";
import { workspaceMembers } from "@repo/database/schema/workspaces";
import { findDomainAccess } from "@repo/api/workspaces/access";
import { createEmbedder, testAiProvider } from "@repo/ai";
import type { EmbedProviderConfig } from "@repo/ai";
import type { SessionWithUser } from "@repo/api/domains/server";
import { resolveActiveWorkspaceId } from "@repo/api/workspaces/active";
import { canEditWorkspace } from "@repo/api/workspaces/roles";

import { decryptSecret, encryptSecret, maskApiKey } from "@repo/api/ai/encryption";
import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  aiProviderLabel,
  isAiProvider,
  resolveBaseUrl,
} from "@repo/api/ai/providers";
import {
  EmbeddingReindexError,
  reindexDomainEmbeddings,
} from "@repo/api/ai/embeddings";
import {
  updateAiConfigSchema,
  type AiConfigView,
  type ResolvedAiProvider,
  type ResolvedEmbeddingProvider,
  type UpdateAiConfigInput,
} from "@repo/api/ai/schemas";

export class AiConfigServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AiConfigServiceError";
  }
}

const unauthorized = () =>
  new AiConfigServiceError(401, "UNAUTHORIZED", "You must be signed in");
const forbidden = () =>
  new AiConfigServiceError(
    403,
    "FORBIDDEN",
    "You do not have access to this workspace",
  );
const noWorkspace = () =>
  new AiConfigServiceError(400, "NO_WORKSPACE", "Create a workspace first");
const domainNotFound = () =>
  new AiConfigServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");

/** The only columns BYOA reads — shared by workspace rows and domain overrides. */
type StoredConfig = {
  provider: string;
  model: string | null;
  embeddingModel: string | null;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
};

const storedFields = {
  provider: aiConfigs.provider,
  model: aiConfigs.model,
  embeddingModel: aiConfigs.embeddingModel,
  baseUrl: aiConfigs.baseUrl,
  apiKeyEncrypted: aiConfigs.apiKeyEncrypted,
};

/**
 * Chooses the row that actually applies: the domain override wins over the
 * workspace default. Exported so the precedence rule is unit-tested without a
 * database.
 */
export function selectEffectiveConfig<Row>(
  workspace: Row | null | undefined,
  override: Row | null | undefined,
): Row | null {
  return override ?? workspace ?? null;
}

/**
 * Embedding settings resolve independently from chat: a domain override that
 * only changes the chat model keeps inheriting the workspace's embedding
 * model. A scope without an embedding model uses the platform embeddings.
 */
export function selectEmbeddingConfig<Row extends { embeddingModel: string | null }>(
  workspace: Row | null | undefined,
  override: Row | null | undefined,
): Row | null {
  if (override?.embeddingModel) return override;
  if (workspace?.embeddingModel) return workspace;
  return null;
}

/**
 * Identifies the vector space of a scope. Provider and base URL matter because
 * the same model name on two providers is not guaranteed to produce comparable
 * vectors.
 */
export function embeddingFingerprint(
  row: Pick<StoredConfig, "provider" | "baseUrl" | "embeddingModel"> | null,
  platformModel: string,
): string {
  if (!row || row.provider === "platform" || !row.embeddingModel) {
    return `platform:${platformModel}`;
  }
  const provider = isAiProvider(row.provider)
    ? row.provider
    : DEFAULT_AI_PROVIDER;
  return `${provider}|${resolveBaseUrl(provider, row.baseUrl) ?? ""}|${row.embeddingModel}`;
}

function toView(row: StoredConfig | null, secret: string | undefined): AiConfigView {
  if (!row) {
    return {
      provider: DEFAULT_AI_PROVIDER,
      model: null,
      embeddingModel: null,
      baseUrl: null,
      maskedApiKey: null,
      hasApiKey: false,
    };
  }
  let maskedApiKey: string | null = null;
  if (row.apiKeyEncrypted) {
    maskedApiKey = "••••••••";
    if (secret) {
      try {
        maskedApiKey = maskApiKey(decryptSecret(row.apiKeyEncrypted, secret));
      } catch {
        // A corrupt/unreadable key still shows as "set" so the owner can
        // replace it instead of wondering why the field looks empty.
      }
    }
  }
  return {
    provider: isAiProvider(row.provider) ? row.provider : DEFAULT_AI_PROVIDER,
    model: row.model,
    embeddingModel: row.embeddingModel,
    baseUrl: row.baseUrl,
    maskedApiKey,
    hasApiKey: Boolean(row.apiKeyEncrypted),
  };
}

function parseInput(input: UpdateAiConfigInput): UpdateAiConfigInput {
  const parsed = updateAiConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new AiConfigServiceError(
      400,
      "INVALID_INPUT",
      parsed.error.issues[0]?.message ?? "Invalid AI provider settings",
    );
  }
  return parsed.data;
}

export function createAiConfigService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
  encryptionSecret: string | undefined;
  platformConfigured: boolean;
  /** Platform embeddings, used when a scope has no BYO embedding model. */
  platformEmbed: EmbedProviderConfig;
}) {
  const {
    db,
    getSession,
    encryptionSecret,
    platformConfigured,
    platformEmbed,
  } = deps;

  const requireSession = async (headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    return session;
  };

  /**
   * The active workspace and the caller's role. The cookie only expresses
   * intent; resolveActiveWorkspaceId already checks membership. Viewers may
   * read, but not change, shared integration settings.
   */
  const requireWorkspace = async (headers: Headers, mutate = false) => {
    const session = await requireSession(headers);
    const workspaceId = await resolveActiveWorkspaceId(
      db,
      headers,
      session.user.id,
    );
    if (!workspaceId) throw noWorkspace();

    if (mutate) {
      const [membership] = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, session.user.id),
          ),
        )
        .limit(1);
      if (!membership || !canEditWorkspace(membership.role)) throw forbidden();
    }

    return { session, workspaceId };
  };

  /**
   * A domain and the caller's access to the workspace it belongs to. API keys
   * are shared by the workspace, not by the user who created the domain.
   */
  const requireDomainAccess = async (
    domainId: string,
    headers: Headers,
    mutate = false,
  ) => {
    const session = await requireSession(headers);
    const access = await findDomainAccess(db, domainId, session.user.id);
    if (access.kind === "not_found") throw domainNotFound();
    if (access.kind === "forbidden") throw forbidden();
    if (mutate && !canEditWorkspace(access.role)) throw forbidden();

    return { session, domain: access.domain };
  };

  const requireEncryption = () => {
    if (!encryptionSecret) {
      throw new AiConfigServiceError(
        503,
        "ENCRYPTION_NOT_CONFIGURED",
        "AI key encryption is not configured on this deployment",
      );
    }
    return encryptionSecret;
  };

  /**
   * Builds the embeddings config for a stored row, or the platform config when
   * the scope has no BYO embedding model.
   */
  const embedConfigForRow = (
    row: Pick<
      StoredConfig,
      "provider" | "baseUrl" | "embeddingModel" | "apiKeyEncrypted"
    > | null,
  ): EmbedProviderConfig => {
    if (!row || row.provider === "platform" || !row.embeddingModel) {
      return platformEmbed;
    }
    const provider = isAiProvider(row.provider)
      ? row.provider
      : DEFAULT_AI_PROVIDER;
    const baseURL = resolveBaseUrl(provider, row.baseUrl);
    if (
      !baseURL ||
      !row.apiKeyEncrypted ||
      !AI_PROVIDERS[provider].supportsEmbeddings
    ) {
      throw new AiConfigServiceError(
        500,
        "AI_CONFIG_INVALID",
        "The saved embeddings configuration is incomplete",
      );
    }
    return {
      apiKey: decryptSecret(row.apiKeyEncrypted, requireEncryption()),
      baseURL,
      model: row.embeddingModel,
      dimensions: platformEmbed.dimensions,
    };
  };

  /** Re-embeds the affected domains, surfacing a useful message on failure. */
  const reindexDomains = async (
    domainIds: string[],
    config: EmbedProviderConfig,
  ) => {
    if (domainIds.length === 0) return;
    try {
      await reindexDomainEmbeddings({
        db,
        domainIds,
        embed: createEmbedder(config).embed,
        model: config.model,
      });
    } catch (error) {
      if (error instanceof EmbeddingReindexError) {
        throw new AiConfigServiceError(400, "REINDEX_FAILED", error.message);
      }
      const message =
        error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
      throw new AiConfigServiceError(
        502,
        "EMBEDDING_FAILED",
        `Could not re-index the knowledge base: ${message}`,
      );
    }
  };

  /**
   * Domains that follow the workspace's embedding model: everything in the
   * workspace except domains with their own embedding model set.
   */
  const workspaceEmbeddingDomainIds = async (workspaceId: string) => {
    const owned = await db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.workspaceId, workspaceId));
    if (owned.length === 0) return [];

    const overrides = await db
      .select({ domainId: domainAiConfigs.domainId })
      .from(domainAiConfigs)
      .innerJoin(domains, eq(domainAiConfigs.domainId, domains.id))
      .where(
        and(
          eq(domains.workspaceId, workspaceId),
          isNotNull(domainAiConfigs.embeddingModel),
        ),
      );
    const excluded = new Set(overrides.map((row) => row.domainId));
    return owned.map((row) => row.id).filter((id) => !excluded.has(id));
  };

  const workspaceRow = async (workspaceId: string) => {
    const [row] = await db
      .select(storedFields)
      .from(aiConfigs)
      .where(eq(aiConfigs.workspaceId, workspaceId))
      .limit(1);
    return (row as StoredConfig | undefined) ?? null;
  };

  const overrideRow = async (domainId: string) => {
    const [row] = await db
      .select({
        provider: domainAiConfigs.provider,
        model: domainAiConfigs.model,
        embeddingModel: domainAiConfigs.embeddingModel,
        baseUrl: domainAiConfigs.baseUrl,
        apiKeyEncrypted: domainAiConfigs.apiKeyEncrypted,
      })
      .from(domainAiConfigs)
      .where(eq(domainAiConfigs.domainId, domainId))
      .limit(1);
    return (row as StoredConfig | undefined) ?? null;
  };

  /**
   * Switching providers requires a fresh key (an OpenAI key is not a Gemini
   * key); editing the model keeps the stored one. Returns the encrypted key.
   */
  const encryptedKeyForSave = (
    input: UpdateAiConfigInput,
    existing: StoredConfig | null,
  ): string | null => {
    if (input.clearApiKey) return null;
    if (input.apiKey) return encryptSecret(input.apiKey, requireEncryption());
    if (existing && existing.provider === input.provider) {
      return existing.apiKeyEncrypted;
    }
    return null;
  };

  /** Model/base URL for one save, merging with the stored row when possible. */
  const saveValues = (
    input: UpdateAiConfigInput,
    existing: StoredConfig | null,
  ): {
    model: string;
    embeddingModel: string | null;
    baseUrl: string | null;
    apiKeyEncrypted: string;
  } => {
    const provider = input.provider;
    const model =
      input.model ||
      (existing?.provider === provider ? existing.model : null) ||
      "";
    if (!model) {
      throw new AiConfigServiceError(
        400,
        "INVALID_INPUT",
        `Model is required for ${aiProviderLabel(provider)}`,
      );
    }

    const embeddingModel =
      provider === "platform"
        ? null
        : input.embeddingModel !== undefined
          ? input.embeddingModel || null
          : existing?.provider === provider
            ? existing.embeddingModel
            : null;
    if (
      embeddingModel &&
      !AI_PROVIDERS[provider].supportsEmbeddings
    ) {
      throw new AiConfigServiceError(
        400,
        "INVALID_INPUT",
        `${aiProviderLabel(provider)} does not expose an embeddings endpoint`,
      );
    }

    const baseUrl =
      input.baseUrl ||
      (existing?.provider === provider && existing?.baseUrl
        ? existing.baseUrl
        : null);
    if (provider === "custom" && !baseUrl) {
      throw new AiConfigServiceError(
        400,
        "INVALID_INPUT",
        "Base URL is required for a custom endpoint",
      );
    }

    const apiKeyEncrypted = encryptedKeyForSave(input, existing);
    if (!apiKeyEncrypted) {
      throw new AiConfigServiceError(
        400,
        "INVALID_INPUT",
        `API key is required for ${aiProviderLabel(provider)}`,
      );
    }

    return {
      model,
      embeddingModel,
      baseUrl: provider === "custom" ? baseUrl : null,
      apiKeyEncrypted,
    };
  };

  return {
    /** Workspace-level config for the settings form. Keys are masked. */
    async getWorkspaceConfig(headers: Headers): Promise<AiConfigView> {
      const session = await requireSession(headers);
      const workspaceId = await resolveActiveWorkspaceId(
        db,
        headers,
        session.user.id,
      );
      if (!workspaceId) return toView(null, encryptionSecret);
      return toView(await workspaceRow(workspaceId), encryptionSecret);
    },

    async updateWorkspaceConfig(input: UpdateAiConfigInput, headers: Headers) {
      const { session, workspaceId } = await requireWorkspace(headers, true);
      const body = parseInput(input);
      const existing = await workspaceRow(workspaceId);

      if (body.provider === "platform") {
        // Reverting to platform embeddings must re-embed the domains that were
        // following the workspace before the row is cleared.
        if (
          embeddingFingerprint(existing, platformEmbed.model) !==
          embeddingFingerprint(null, platformEmbed.model)
        ) {
          await reindexDomains(
            await workspaceEmbeddingDomainIds(workspaceId),
            platformEmbed,
          );
        }
        await db
          .insert(aiConfigs)
          .values({
            workspaceId,
            ownerId: session.user.id,
            provider: "platform",
            embeddingModel: null,
          })
          .onConflictDoUpdate({
            target: [aiConfigs.workspaceId],
            set: {
              provider: "platform",
              model: null,
              embeddingModel: null,
              baseUrl: null,
              apiKeyEncrypted: null,
              updatedAt: new Date(),
            },
          });
        return;
      }

      const values = saveValues(body, existing);
      const nextRow: StoredConfig = {
        provider: body.provider,
        model: values.model,
        embeddingModel: values.embeddingModel,
        baseUrl: values.baseUrl,
        apiKeyEncrypted: values.apiKeyEncrypted,
      };
      if (
        embeddingFingerprint(existing, platformEmbed.model) !==
        embeddingFingerprint(nextRow, platformEmbed.model)
      ) {
        await reindexDomains(
          await workspaceEmbeddingDomainIds(workspaceId),
          embedConfigForRow(nextRow),
        );
      }

      await db
        .insert(aiConfigs)
        .values({
          workspaceId,
          ownerId: session.user.id,
          provider: body.provider,
          ...values,
        })
        .onConflictDoUpdate({
          target: [aiConfigs.workspaceId],
          set: { provider: body.provider, ...values, updatedAt: new Date() },
        });
    },

    /** The domain override, or null when the domain inherits the workspace. */
    async getDomainOverride(
      domainId: string,
      headers: Headers,
    ): Promise<AiConfigView | null> {
      await requireDomainAccess(domainId, headers);
      const row = await overrideRow(domainId);
      return row ? toView(row, encryptionSecret) : null;
    },

    async updateDomainOverride(
      input: UpdateAiConfigInput,
      domainId: string,
      headers: Headers,
    ) {
      const { domain } = await requireDomainAccess(domainId, headers, true);
      const body = parseInput(input);
      if (body.provider === "platform") {
        throw new AiConfigServiceError(
          400,
          "INVALID_INPUT",
          "Remove the override to use the workspace default",
        );
      }

      const [workspaceConfig, existing] = await Promise.all([
        workspaceRow(domain.workspaceId),
        overrideRow(domainId),
      ]);
      const values = saveValues(body, existing);
      const nextRow: StoredConfig = {
        provider: body.provider,
        model: values.model,
        embeddingModel: values.embeddingModel,
        baseUrl: values.baseUrl,
        apiKeyEncrypted: values.apiKeyEncrypted,
      };

      const oldEmbedding = selectEmbeddingConfig(workspaceConfig, existing);
      const newEmbedding = selectEmbeddingConfig(workspaceConfig, nextRow);
      if (
        embeddingFingerprint(oldEmbedding, platformEmbed.model) !==
        embeddingFingerprint(newEmbedding, platformEmbed.model)
      ) {
        await reindexDomains([domainId], embedConfigForRow(newEmbedding));
      }

      await db
        .insert(domainAiConfigs)
        .values({ domainId, provider: body.provider, ...values })
        .onConflictDoUpdate({
          target: [domainAiConfigs.domainId],
          set: { provider: body.provider, ...values, updatedAt: new Date() },
        });
    },

    async deleteDomainOverride(domainId: string, headers: Headers) {
      const { domain } = await requireDomainAccess(domainId, headers, true);
      const [workspaceConfig, existing] = await Promise.all([
        workspaceRow(domain.workspaceId),
        overrideRow(domainId),
      ]);

      // Removing an override may move the domain back to the workspace's (or
      // the platform's) vector space, so re-embed before deleting the row.
      const oldEmbedding = selectEmbeddingConfig(workspaceConfig, existing);
      const newEmbedding = selectEmbeddingConfig(workspaceConfig, null);
      if (
        embeddingFingerprint(oldEmbedding, platformEmbed.model) !==
        embeddingFingerprint(newEmbedding, platformEmbed.model)
      ) {
        await reindexDomains([domainId], embedConfigForRow(newEmbedding));
      }

      await db
        .delete(domainAiConfigs)
        .where(eq(domainAiConfigs.domainId, domainId));
    },

    /**
     * Provider config for the chat runtime: domain override → workspace
     * default → platform. Returns null for the platform (no custom client
     * needed). Throws if a stored row cannot be used (missing key/secret) —
     * the caller decides whether to fall back.
     */
    async resolveForDomain(
      domainId: string,
      workspaceId: string,
    ): Promise<ResolvedAiProvider | null> {
      const [workspaceConfig, override] = await Promise.all([
        workspaceRow(workspaceId),
        overrideRow(domainId),
      ]);
      const selected = selectEffectiveConfig(workspaceConfig, override);
      if (!selected || selected.provider === "platform") return null;

      const provider = isAiProvider(selected.provider)
        ? selected.provider
        : DEFAULT_AI_PROVIDER;
      if (provider === "platform") return null;

      const baseURL = resolveBaseUrl(provider, selected.baseUrl);
      if (!selected.apiKeyEncrypted || !baseURL || !selected.model) {
        throw new AiConfigServiceError(
          500,
          "AI_CONFIG_INVALID",
          "The saved AI provider configuration is incomplete",
        );
      }
      return {
        provider,
        apiKey: decryptSecret(selected.apiKeyEncrypted, requireEncryption()),
        baseURL,
        model: selected.model,
      };
    },

    /**
     * Embeddings config for the knowledge runtime. Returns null when the
     * effective scope uses the platform model. Throws instead of silently
     * falling back when a saved BYO config cannot be used: mixing vector
     * spaces would return meaningless search results.
     */
    async resolveEmbeddingForDomain(
      domainId: string,
      workspaceId: string,
    ): Promise<ResolvedEmbeddingProvider | null> {
      const [workspaceConfig, override] = await Promise.all([
        workspaceRow(workspaceId),
        overrideRow(domainId),
      ]);
      const selected = selectEmbeddingConfig(workspaceConfig, override);
      if (!selected) return null;

      const provider = isAiProvider(selected.provider)
        ? selected.provider
        : DEFAULT_AI_PROVIDER;
      if (provider === "platform") return null;

      const baseURL = resolveBaseUrl(provider, selected.baseUrl);
      if (
        !baseURL ||
        !selected.apiKeyEncrypted ||
        !selected.embeddingModel ||
        !AI_PROVIDERS[provider].supportsEmbeddings
      ) {
        throw new AiConfigServiceError(
          500,
          "AI_CONFIG_INVALID",
          "The saved embeddings configuration is incomplete",
        );
      }
      return {
        provider,
        apiKey: decryptSecret(selected.apiKeyEncrypted, requireEncryption()),
        baseURL,
        model: selected.embeddingModel,
      };
    },

    /**
     * Sends a tiny prompt with the saved config. Tests the domain override when
     * a domain is given, otherwise the workspace config. When the effective
     * scope has a BYO embedding model, its embeddings endpoint is probed too.
     */
    async testConnection(
      headers: Headers,
      domainId?: string,
    ): Promise<{ ok: boolean; message: string }> {
      let row: StoredConfig | null;
      let workspaceConfig: StoredConfig | null = null;
      let override: StoredConfig | null = null;
      if (domainId) {
        const { domain } = await requireDomainAccess(domainId, headers);
        [workspaceConfig, override] = await Promise.all([
          workspaceRow(domain.workspaceId),
          overrideRow(domainId),
        ]);
        row = override ?? workspaceConfig;
      } else {
        const { workspaceId } = await requireWorkspace(headers);
        workspaceConfig = await workspaceRow(workspaceId);
        row = workspaceConfig;
      }

      if (!row || row.provider === "platform") {
        return platformConfigured
          ? { ok: true, message: "The platform default model is ready." }
          : {
              ok: false,
              message: "The platform model is not configured on this deployment.",
            };
      }

      const provider = isAiProvider(row.provider)
        ? row.provider
        : DEFAULT_AI_PROVIDER;
      if (provider === "platform") {
        return { ok: true, message: "The platform default model is ready." };
      }

      let embeddingLabel = "";
      try {
        const baseURL = resolveBaseUrl(provider, row.baseUrl);
        if (!baseURL || !row.apiKeyEncrypted || !row.model) {
          return { ok: false, message: "The configuration is incomplete." };
        }
        await testAiProvider({
          apiKey: decryptSecret(row.apiKeyEncrypted, requireEncryption()),
          baseURL,
          model: row.model,
        });

        const embeddingRow = selectEmbeddingConfig(workspaceConfig, override);
        if (embeddingRow) {
          const embeddingConfig = embedConfigForRow(embeddingRow);
          await createEmbedder(embeddingConfig).embed(["connection test"]);
          embeddingLabel = ` · embeddings ${embeddingConfig.model}`;
        }

        return {
          ok: true,
          message: `Connected — ${aiProviderLabel(provider)} · ${row.model}${embeddingLabel}`,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 200) : "Unknown error";
        return { ok: false, message: `Could not connect: ${message}` };
      }
    },
  };
}

export type AiConfigService = ReturnType<typeof createAiConfigService>;
