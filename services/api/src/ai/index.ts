export {
  createAiConfigService,
  AiConfigServiceError,
  selectEffectiveConfig,
} from "@repo/api/ai/server";

export type { AiConfigService } from "@repo/api/ai/server";

export {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  BYO_PROVIDER_IDS,
  DEFAULT_AI_PROVIDER,
  aiProviderLabel,
  isAiProvider,
  resolveBaseUrl,
} from "@repo/api/ai/providers";

export type { AiProviderId } from "@repo/api/ai/providers";

export {
  aiProviderSchema,
  updateAiConfigSchema,
} from "@repo/api/ai/schemas";

export type {
  AiConfigView,
  ResolvedAiProvider,
  UpdateAiConfigInput,
} from "@repo/api/ai/schemas";
