import { eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { aiConfigs, domainAiConfigs } from "@repo/database/schema";
import { domains } from "@repo/database/schema/domains";
import { testAiProvider } from "@repo/ai";
import type { SessionWithUser } from "@repo/api/domains/server";

import { decryptSecret, encryptSecret, maskApiKey } from "@repo/api/ai/encryption";
import {
  DEFAULT_AI_PROVIDER,
  aiProviderLabel,
  isAiProvider,
  resolveBaseUrl,
} from "@repo/api/ai/providers";
import {
  updateAiConfigSchema,
  type AiConfigView,
  type ResolvedAiProvider,
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
  new AiConfigServiceError(403, "FORBIDDEN", "You do not own this domain");
const domainNotFound = () =>
  new AiConfigServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");

/** The only columns BYOA reads — shared by account rows and domain overrides. */
type StoredConfig = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
};

const storedFields = {
  provider: aiConfigs.provider,
  model: aiConfigs.model,
  baseUrl: aiConfigs.baseUrl,
  apiKeyEncrypted: aiConfigs.apiKeyEncrypted,
};

/**
 * Chooses the row that actually applies: the domain override wins over the
 * account default. Exported so the precedence rule is unit-tested without a
 * database.
 */
export function selectEffectiveConfig<Row>(
  account: Row | null | undefined,
  override: Row | null | undefined,
): Row | null {
  return override ?? account ?? null;
}

function toView(row: StoredConfig | null, secret: string | undefined): AiConfigView {
  if (!row) {
    return {
      provider: DEFAULT_AI_PROVIDER,
      model: null,
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
}) {
  const { db, getSession, encryptionSecret, platformConfigured } = deps;

  const requireSession = async (headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    return session;
  };

  // API keys are sensitive: only the domain owner may read or change them,
  // not every workspace member who can edit the domain's public settings.
  const requireOwnedDomain = async (domainId: string, headers: Headers) => {
    const session = await requireSession(headers);
    const [domain] = await db
      .select({ id: domains.id, ownerId: domains.ownerId })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);
    if (!domain) throw domainNotFound();
    if (domain.ownerId !== session.user.id) throw forbidden();
    return session;
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

  const accountRow = async (ownerId: string) => {
    const [row] = await db
      .select(storedFields)
      .from(aiConfigs)
      .where(eq(aiConfigs.ownerId, ownerId))
      .limit(1);
    return (row as StoredConfig | undefined) ?? null;
  };

  const overrideRow = async (domainId: string) => {
    const [row] = await db
      .select({
        provider: domainAiConfigs.provider,
        model: domainAiConfigs.model,
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
  ): { model: string; baseUrl: string | null; apiKeyEncrypted: string } => {
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
      baseUrl: provider === "custom" ? baseUrl : null,
      apiKeyEncrypted,
    };
  };

  return {
    /** Account-level config for the settings form. Keys are masked. */
    async getAccountConfig(headers: Headers): Promise<AiConfigView> {
      const session = await requireSession(headers);
      return toView(await accountRow(session.user.id), encryptionSecret);
    },

    async updateAccountConfig(input: UpdateAiConfigInput, headers: Headers) {
      const session = await requireSession(headers);
      const body = parseInput(input);
      const existing = await accountRow(session.user.id);

      if (body.provider === "platform") {
        await db
          .insert(aiConfigs)
          .values({ ownerId: session.user.id, provider: "platform" })
          .onConflictDoUpdate({
            target: [aiConfigs.ownerId],
            set: {
              provider: "platform",
              model: null,
              baseUrl: null,
              apiKeyEncrypted: null,
              updatedAt: new Date(),
            },
          });
        return;
      }

      const values = saveValues(body, existing);
      await db
        .insert(aiConfigs)
        .values({ ownerId: session.user.id, provider: body.provider, ...values })
        .onConflictDoUpdate({
          target: [aiConfigs.ownerId],
          set: { provider: body.provider, ...values, updatedAt: new Date() },
        });
    },

    /** The domain override, or null when the domain inherits the account. */
    async getDomainOverride(
      domainId: string,
      headers: Headers,
    ): Promise<AiConfigView | null> {
      await requireOwnedDomain(domainId, headers);
      const row = await overrideRow(domainId);
      return row ? toView(row, encryptionSecret) : null;
    },

    async updateDomainOverride(
      input: UpdateAiConfigInput,
      domainId: string,
      headers: Headers,
    ) {
      await requireOwnedDomain(domainId, headers);
      const body = parseInput(input);
      if (body.provider === "platform") {
        throw new AiConfigServiceError(
          400,
          "INVALID_INPUT",
          "Remove the override to use the account default",
        );
      }

      const existing = await overrideRow(domainId);
      const values = saveValues(body, existing);
      await db
        .insert(domainAiConfigs)
        .values({ domainId, provider: body.provider, ...values })
        .onConflictDoUpdate({
          target: [domainAiConfigs.domainId],
          set: { provider: body.provider, ...values, updatedAt: new Date() },
        });
    },

    async deleteDomainOverride(domainId: string, headers: Headers) {
      await requireOwnedDomain(domainId, headers);
      await db
        .delete(domainAiConfigs)
        .where(eq(domainAiConfigs.domainId, domainId));
    },

    /**
     * Provider config for the chat runtime: domain override → account default
     * → platform. Returns null for the platform (no custom client needed).
     * Throws if a stored row cannot be used (missing key/secret) — the caller
     * decides whether to fall back.
     */
    async resolveForDomain(
      domainId: string,
      ownerId: string,
    ): Promise<ResolvedAiProvider | null> {
      const [account, override] = await Promise.all([
        accountRow(ownerId),
        overrideRow(domainId),
      ]);
      const selected = selectEffectiveConfig(account, override);
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
     * Sends a tiny prompt with the saved config. Tests the domain override when
     * a domain is given, otherwise the account config.
     */
    async testConnection(
      headers: Headers,
      domainId?: string,
    ): Promise<{ ok: boolean; message: string }> {
      let row: StoredConfig | null;
      if (domainId) {
        const session = await requireOwnedDomain(domainId, headers);
        row =
          (await overrideRow(domainId)) ?? (await accountRow(session.user.id));
      } else {
        const session = await requireSession(headers);
        row = await accountRow(session.user.id);
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
        return {
          ok: true,
          message: `Connected — ${aiProviderLabel(provider)} · ${row.model}`,
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
