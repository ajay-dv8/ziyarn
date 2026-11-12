"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  type AiProviderId,
} from "@repo/api/ai/providers";
import type { AiConfigView } from "@repo/api/ai/schemas";
import { EMBEDDING_DIMENSIONS } from "@repo/api/ai/schemas";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import {
  clearDomainAiOverrideAction,
  saveAiConfigAction,
  testAiConnectionAction,
} from "@/lib/actions/ai-config";

/**
 * One form for both scopes: the account default (`mode="account"`) and a
 * per-domain override (`mode="domain"`). The only structural difference is
 * inheritance — a domain can revert to the account default.
 */
export function AiProviderForm({
  mode,
  current,
  domainId,
  accountLabel,
  hasOverride,
}: {
  mode: "account" | "domain";
  current: AiConfigView;
  domainId?: string;
  /** Human summary of the account default, shown when a domain inherits it. */
  accountLabel?: string;
  /** Domain mode only: whether the domain currently has its own provider row. */
  hasOverride?: boolean;
}) {
  const isDomain = mode === "domain";
  const router = useRouter();
  const [enabled, setEnabled] = useState(!isDomain || Boolean(hasOverride));
  const [provider, setProvider] = useState<AiProviderId>(
    current.provider !== "platform"
      ? current.provider
      : isDomain
        ? "openai"
        : "platform",
  );
  const [model, setModel] = useState(current.model ?? "");
  const [embeddingModel, setEmbeddingModel] = useState(
    // A domain without its own row inherits the account's model; showing it
    // here would copy it into a new override by accident.
    isDomain && !hasOverride ? "" : (current.embeddingModel ?? ""),
  );
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(current.baseUrl ?? "");
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showProviderFields = provider !== "platform";
  const providerEntry = AI_PROVIDERS[provider];
  const embeddingPlaceholder =
    provider === "openai"
      ? "text-embedding-3-small"
      : provider === "gemini"
        ? "gemini-embedding-001"
        : "your-embedding-model";

  async function save() {
    setPending(true);
    setError(null);
    setFeedback(null);
    const result = await saveAiConfigAction({
      provider,
      ...(showProviderFields
        ? {
            model: model.trim() || undefined,
            embeddingModel: providerEntry.supportsEmbeddings
              ? embeddingModel.trim()
              : undefined,
            apiKey: apiKey.trim() || undefined,
            baseUrl:
              provider === "custom" ? baseUrl.trim() || undefined : undefined,
          }
        : {}),
      ...(isDomain ? { domainId } : {}),
    });
    setPending(false);
    if (result.ok) {
      setApiKey("");
      setFeedback("Saved");
      // Refresh the server props so the masked key and the domain's
      // "revert" state reflect what was just stored.
      router.refresh();
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setError(result.error);
    }
  }

  async function test() {
    setTesting(true);
    setError(null);
    setFeedback(null);
    const result = await testAiConnectionAction(domainId);
    setTesting(false);
    if (result.ok) {
      setFeedback(result.message);
    } else {
      setError(result.message);
    }
  }

  async function revertToAccount() {
    if (!domainId) return;
    setPending(true);
    setError(null);
    const result = await clearDomainAiOverrideAction(domainId);
    setPending(false);
    if (result.ok) {
      setEnabled(false);
      setFeedback("Using the account default");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const providerOptions = isDomain
    ? AI_PROVIDER_IDS.filter((id) => id !== "platform")
    : AI_PROVIDER_IDS;

  return (
    <div className="space-y-4">
      {isDomain ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setFeedback(null);
                setError(null);
              }}
            />
            Use a custom AI provider for this domain
          </label>
          {!enabled ? (
            <p className="text-xs text-muted-foreground">
              {`Inheriting the account default${accountLabel ? ` — ${accountLabel}` : ""}.`}
            </p>
          ) : null}
          {hasOverride ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={revertToAccount}
              disabled={pending}
            >
              Revert to account default
            </Button>
          ) : null}
        </div>
      ) : null}

      {enabled ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`ai-provider-${mode}`}>Provider</Label>
            <select
              id={`ai-provider-${mode}`}
              value={provider}
              onChange={(event) => {
                const nextProvider = event.target.value as AiProviderId;
                if (nextProvider !== provider) setEmbeddingModel("");
                setProvider(nextProvider);
                setFeedback(null);
                setError(null);
              }}
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {providerOptions.map((id) => (
                <option key={id} value={id}>
                  {AI_PROVIDERS[id].label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {providerEntry.description}
            </p>
          </div>

          {showProviderFields ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={`ai-model-${mode}`}>Model</Label>
                <Input
                  id={`ai-model-${mode}`}
                  value={model}
                  maxLength={200}
                  placeholder={providerEntry.modelPlaceholder}
                  onChange={(event) => setModel(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`ai-key-${mode}`}>API key</Label>
                <Input
                  id={`ai-key-${mode}`}
                  type="password"
                  autoComplete="off"
                  maxLength={500}
                  value={apiKey}
                  placeholder={current.maskedApiKey ?? "Paste the provider key"}
                  onChange={(event) => setApiKey(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {current.hasApiKey
                    ? "Leave blank to keep the saved key. Switching providers requires a new one."
                    : "Stored encrypted at rest and never returned in full."}
                </p>
              </div>

              {provider === "custom" ? (
                <div className="space-y-2">
                  <Label htmlFor={`ai-base-url-${mode}`}>Base URL</Label>
                  <Input
                    id={`ai-base-url-${mode}`}
                    maxLength={500}
                    value={baseUrl}
                    placeholder="https://my-endpoint.example.com/v1"
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                </div>
              ) : null}

              {providerEntry.supportsEmbeddings ? (
                <div className="space-y-2">
                  <Label htmlFor={`ai-embedding-model-${mode}`}>
                    Embeddings model (optional)
                  </Label>
                  <Input
                    id={`ai-embedding-model-${mode}`}
                    value={embeddingModel}
                    maxLength={200}
                    placeholder={embeddingPlaceholder}
                    onChange={(event) => setEmbeddingModel(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {isDomain
                      ? "Leave blank to inherit the account embeddings (or the platform model when the account has none). Saving a model re-embeds this domain's knowledge base before the change takes effect."
                      : "Leave blank to use the platform embeddings. Saving a model re-embeds the knowledge base of every domain that inherits your account setting before the change takes effect."}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {providerEntry.label} has no embeddings endpoint, so{" "}
                  {isDomain
                    ? "this domain keeps inheriting the account or platform embeddings."
                    : "knowledge search keeps using the platform embeddings."}
                </p>
              )}
            </>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {feedback ? (
            <p className="text-sm text-muted-foreground">{feedback}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={test}
              disabled={pending || testing}
            >
              {testing ? "Testing…" : "Test saved connection"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Embeddings default to the platform model. A custom embeddings model
            must return {EMBEDDING_DIMENSIONS}-dimension vectors and support the
            OpenAI embeddings endpoint.
          </p>
        </>
      ) : null}
    </div>
  );
}
