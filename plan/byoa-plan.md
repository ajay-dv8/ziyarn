# Bring Your Own API (BYOA) Plan

Allow users to supply their own AI provider keys (OpenAI, Anthropic,
Gemini, OpenRouter, or a custom OpenAI-compatible endpoint) instead of
relying on the platform's default Gemini model.

## Goals

- Users can configure a custom AI provider at the **account level**
  (shared across all domains) with an optional **per-domain override**.
- Supports chat completions **and** embeddings (knowledge base).
- If the user's chosen provider does not support embeddings, notify
  the user and fall back to the platform's system model for embeddings.
- Available on **all plans**.
- Supported providers: OpenAI, Anthropic, Gemini, OpenRouter, Custom
  (any OpenAI-compatible endpoint).

## Architecture Overview

```
┌──────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Dashboard   │────>│  Settings API    │────>│  domain_ai_    │
│  Settings UI │     │  (encrypt keys)  │     │  config table  │
└──────────────┘     └──────────────────┘     └───────┬────────┘
                                                      │
┌──────────────┐     ┌──────────────────┐             │
│  Chat API    │────>│  AI Service      │<────────────┘
│  Route       │     │  (per-request)   │
└──────────────┘     └──────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Provider   │
                    │  Adapters   │
                    ├─────────────┤
                    │ • OpenAI    │
                    │ • Anthropic │
                    │ • Gemini    │
                    │ • OpenRouter│
                    │ • Custom    │
                    └─────────────┘
```

---

## Phase 1: Database Schema

### New table: `domain_ai_config`

```sql
CREATE TABLE domain_ai_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Account-level defaults (used when no domain override exists)
  provider      text NOT NULL DEFAULT 'platform',  -- platform | openai | anthropic | gemini | openrouter | custom
  model         text,          -- e.g. 'gpt-4o', 'claude-sonnet-4-20250514'
  api_key_encrypted text,      -- AES-256-GCM encrypted
  base_url      text,          -- for custom providers
  max_tokens    integer DEFAULT 4096,
  temperature   real DEFAULT 0.7,

  -- Embedding config (separate from chat)
  embed_provider text DEFAULT 'platform',  -- platform | openai | gemini | custom
  embed_model    text,          -- e.g. 'text-embedding-3-small'
  embed_api_key_encrypted text,
  embed_base_url text,
  embed_dimensions integer DEFAULT 1536,

  supports_tool_calling boolean DEFAULT true,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE(owner_id)
);
```

### New table: `domain_ai_config_overrides`

Per-domain overrides. When present, these override the account-level
config for that specific domain.

```sql
CREATE TABLE domain_ai_config_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id     uuid NOT NULL REFERENCES domains(id) ON DELETE CASCADE UNIQUE,

  -- Same columns as domain_ai_config, but all nullable
  -- (NULL means "use account default")
  provider      text,
  model         text,
  api_key_encrypted text,
  base_url      text,
  max_tokens    integer,
  temperature   real,

  embed_provider text,
  embed_model    text,
  embed_api_key_encrypted text,
  embed_base_url text,
  embed_dimensions integer,

  supports_tool_calling boolean,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

### Migration

- [ ] Generate Drizzle migration for both tables
- [ ] Add `owner_id` index on `domain_ai_config`
- [ ] Add `domain_id` unique index on `domain_ai_config_overrides`

---

## Phase 2: Encryption & Key Management

### Encryption utility

- [ ] Create `packages/crypto/src/encrypt.ts` with `encrypt(plaintext, key)` and `decrypt(ciphertext, key)` using AES-256-GCM
- [ ] Encryption key from env var `AI_KEY_ENCRYPTION_SECRET` (32-byte hex)
- [ ] IV generated randomly per encryption call
- [ ] Auth tag stored alongside ciphertext (format: `iv:authTag:ciphertext`)

### Key handling rules

- API keys are **encrypted at rest** in the database
- Keys are **never returned** in full via API — only a masked preview
  (e.g. `sk-...abc123`)
- The decrypted key is only loaded into memory when instantiating the
  AI service for a chat request
- Keys are **never logged**

---

## Phase 3: AI Service Refactor

### Current state

- `createAiService()` in `services/ai/src/index.ts` creates a provider
  from `AiProviderConfig { apiKey, baseURL, model }`
- Uses OpenAI SDK as universal client — works for OpenAI-compatible APIs
- Global singleton in `apps/web/services/chat-service.ts`

### Changes

- [ ] Keep `createAiService()` as-is but make it **callable per-request**
- [ ] Add provider-specific adapters for non-OpenAI-compatible APIs:

#### Provider adapters

| Provider | Base URL | SDK | Notes |
|----------|----------|-----|-------|
| OpenAI | `https://api.openai.com/v1` | OpenAI SDK | Already works |
| Anthropic | N/A | Anthropic SDK | NOT OpenAI-compatible — needs `@anthropic-ai/sdk` adapter |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI SDK | Already works |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenAI SDK | Already works |
| Custom | User-provided | OpenAI SDK | Already works |

- [ ] Create `services/ai/src/providers/anthropic.ts` adapter that:
  - Transforms OpenAI-style tool definitions to Anthropic tool format
  - Transforms streaming chunks to the standard `AiStreamEvent` format
  - Maps system prompt to Anthropic's `system` parameter
- [ ] Add `createAnthropicAdapter(config)` alongside the existing
  `createAiService()` for OpenAI-compatible providers

### Embedding fallback logic

```
1. Look up domain AI config (account + domain override merged)
2. If embed_provider ≠ 'platform':
   a. Try to create embedding service with user's provider
   b. If it fails (provider doesn't support embeddings, or key is invalid):
      - Log warning
      - Fall back to platform Gemini embedding
      - Store a flag to notify the user on next dashboard visit
3. If embed_provider = 'platform':
   - Use platform Gemini embedding (current behavior)
```

---

## Phase 4: API Layer

### Settings service (`services/api/src/settings/`)

- [ ] `getAiConfig(ownerId)` — returns account-level AI config with masked keys
- [ ] `getAiConfigForDomain(domainId)` — returns merged config (account + domain override)
- [ ] `updateAiConfig(ownerId, data)` — upserts account-level config, encrypts keys
- [ ] `upsertDomainAiOverride(domainId, data)` — upserts per-domain override
- [ ] `deleteDomainAiOverride(domainId)` — removes domain override (reverts to account default)
- [ ] `testAiConnection(ownerId, domainId?)` — sends a small test prompt to validate the config

### Validation schemas

- [ ] `updateAiConfigSchema` — validates provider enum, model string, encrypted key format
- [ ] `upsertDomainAiOverrideSchema` — same fields, all optional
- [ ] `testAiConnectionSchema`

### Chat route changes (`apps/web/app/api/chat/route.ts`)

- [ ] Replace global `aiService` import with per-request provider lookup
- [ ] Resolve AI config: domain override → account default → platform default
- [ ] Instantiate `createAiService()` with resolved config
- [ ] For embeddings in knowledge tool: use resolved embed config with
  platform fallback

---

## Phase 5: Dashboard UI

### Settings page — new "AI Provider" section

Location: `apps/web/app/dashboard/settings/page.tsx`

**Account-level form:**

```
┌─────────────────────────────────────────────────┐
│ AI Provider                                     │
│                                                 │
│ Provider:  [OpenAI        ▾]                    │
│ API Key:   [sk-••••••••••••••••    ] [Test]    │
│ Model:     [gpt-4o         ▾]                   │
│ Max Tokens: [4096]                              │
│ Temperature: [0.7]                              │
│                                                 │
│ Embedding Provider: [Auto (system) ▾]           │
│ Embedding Model:    [text-embedding-3-small]    │
│ Embedding API Key:  [sk-••••••••••••   ] [Test]│
│                                                 │
│ [Save]                                          │
│                                                 │
│ ℹ️ If your provider does not support embeddings,│
│   the system will use the default platform      │
│   model for knowledge base indexing.            │
└─────────────────────────────────────────────────┘
```

**Provider dropdown options:**
- Platform Default (uses Ziyarn's Gemini)
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Custom (OpenAI-compatible)

**Per-domain override:**
- On the domain settings page, add an "AI Provider" card
- Toggle: "Use account default" / "Use custom provider"
- Same fields as account-level, but only for that domain

### Components to create

- [ ] `apps/web/components/settings/ai-provider-form.tsx`
- [ ] `apps/web/components/settings/ai-provider-test-button.tsx`
- [ ] `apps/web/components/domains/domain-ai-override-card.tsx`

---

## Phase 6: Notification & Fallback UX

### Embedding fallback notification

When a user's chosen provider doesn't support embeddings:

1. During the first chat/knowledge request after config, detect the failure
2. Store a flag: `embedding_fallback_active: true` in the AI config
3. On next dashboard visit, show a banner:
   > "Your AI provider (Anthropic) does not support embeddings. Your
   > knowledge base is indexed using the platform's default model.
   > This does not affect chat responses."

### Connection test results

- ✅ "Connected! Using GPT-4o for chat and embeddings."
- ✅ "Connected! Using Claude for chat. Embeddings will use the platform default."
- ❌ "Could not connect. Check your API key and try again."
- ⚠️ "Connected but model not found. Check the model name."

---

## Phase 7: Migration & Rollout

- [ ] Write Drizzle migration
- [ ] Run `drizzle-kit generate` + `drizzle-kit migrate` (or manual SQL)
- [ ] Add `AI_KEY_ENCRYPTION_SECRET` to `.env` and `turbo.json` globalEnv
- [ ] Update `.env.example` with new env vars
- [ ] Add documentation page: `content/docs/byoa.mdx`

---

## File Checklist

### New files
- `packages/database/src/schema/ai-config.ts`
- `packages/database/drizzle/0023_byoa.sql`
- `packages/crypto/src/encrypt.ts`
- `packages/crypto/src/index.ts`
- `packages/crypto/package.json`
- `services/ai/src/providers/anthropic.ts`
- `services/api/src/settings/ai-config.ts`
- `services/api/src/settings/ai-schemas.ts`
- `apps/web/components/settings/ai-provider-form.tsx`
- `apps/web/components/settings/ai-provider-test-button.tsx`
- `apps/web/components/domains/domain-ai-override-card.tsx`
- `apps/web/app/api/settings/ai/route.ts`
- `apps/web/app/api/settings/ai/test/route.ts`
- `content/docs/byoa.mdx`

### Modified files
- `packages/database/src/schema/index.ts` (export new tables)
- `services/ai/src/index.ts` (export `createAiService` without singleton)
- `services/api/src/settings/server.ts` (add AI config methods)
- `services/api/src/settings/schemas.ts` (add AI schemas)
- `apps/web/services/chat-service.ts` (per-request provider)
- `apps/web/app/api/chat/route.ts` (per-domain AI config)
- `apps/web/app/dashboard/settings/page.tsx` (AI provider section)
- `apps/web/app/dashboard/domains/[domainId]/page.tsx` (AI override card)
- `apps/web/package.json` (add `@anthropic-ai/sdk`)
- `.env.example` (add AI_KEY_ENCRYPTION_SECRET)
- `turbo.json` globalEnv (add AI_KEY_ENCRYPTION_SECRET)
