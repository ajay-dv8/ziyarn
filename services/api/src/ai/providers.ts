/**
 * AI provider registry — the single source of truth for BYOA.
 *
 * Every provider except `platform` and `anthropic` (not yet supported) speaks
 * the OpenAI chat-completions protocol, so one adapter already covers them.
 * Adding a provider is one row here (the DB stores plain text).
 */
export type AiProviderConfigRow = {
  label: string;
  description: string;
  /** Fixed OpenAI-compatible base URL, or null when the owner supplies one. */
  baseUrl: string | null;
  customBaseUrl: boolean;
  modelPlaceholder: string;
};

export const AI_PROVIDERS = {
  platform: {
    label: "Platform default",
    description: "Ziyarn's own model — no key needed, included in your plan.",
    baseUrl: null,
    customBaseUrl: false,
    modelPlaceholder: "",
  },
  openai: {
    label: "OpenAI",
    description: "Uses your OpenAI API key and model.",
    baseUrl: "https://api.openai.com/v1",
    customBaseUrl: false,
    modelPlaceholder: "gpt-4o-mini",
  },
  gemini: {
    label: "Google Gemini",
    description: "Gemini through its OpenAI-compatible endpoint.",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    customBaseUrl: false,
    modelPlaceholder: "gemini-2.0-flash",
  },
  openrouter: {
    label: "OpenRouter",
    description: "One key for many models — use OpenRouter model ids.",
    baseUrl: "https://openrouter.ai/api/v1",
    customBaseUrl: false,
    modelPlaceholder: "openai/gpt-4o-mini",
  },
  custom: {
    label: "Custom endpoint",
    description: "Any OpenAI-compatible API (Ollama, vLLM, a proxy…).",
    baseUrl: null,
    customBaseUrl: true,
    modelPlaceholder: "your-model-name",
  },
} as const satisfies Record<string, AiProviderConfigRow>;

export type AiProviderId = keyof typeof AI_PROVIDERS;

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[];

export const DEFAULT_AI_PROVIDER: AiProviderId = "platform";

/** Providers that need a user-supplied key (everything but the platform). */
export const BYO_PROVIDER_IDS = AI_PROVIDER_IDS.filter(
  (provider): provider is Exclude<AiProviderId, "platform"> =>
    provider !== "platform",
);

export function isAiProvider(value: unknown): value is AiProviderId {
  return typeof value === "string" && value in AI_PROVIDERS;
}

export function aiProviderLabel(provider: AiProviderId): string {
  return AI_PROVIDERS[provider].label;
}

/** The base URL to call: the fixed one, or the owner's for custom endpoints. */
export function resolveBaseUrl(
  provider: AiProviderId,
  customBaseUrl: string | null,
): string | null {
  const entry = AI_PROVIDERS[provider];
  return entry.customBaseUrl ? customBaseUrl : entry.baseUrl;
}
