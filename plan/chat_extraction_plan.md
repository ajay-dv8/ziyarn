# Chat Route Extraction Plan

## Goal
Extract ~500 lines of business logic from `apps/web/app/api/chat/route.ts` (708 lines) into `services/api/src/chat/`, leaving the route as a thin HTTP wrapper (~80 lines).

## Current State
- `route.ts` contains: system prompt builder, tool executor, POST handler, GET handler, SSE delta stream, CORS config
- `chat/server.ts` has: conversation CRUD (appendMessage, listMessages, contextMessages, etc.)
- `chat/schemas.ts` has: sendMessageSchema, appendMessageSchema, etc.
- `chat/index.ts` re-exports everything

## Architecture
```
apps/web/app/api/chat/route.ts          (thin HTTP wrapper — CORS, auth, delegates)
  └─ services/api/src/chat/server.ts     (all business logic — prompt, tools, handlers)
       ├─ services/api/src/chat/tool-executor.ts  (tool execution — capture_email, book, pay, etc.)
       └─ services/api/src/chat/schemas.ts        (zod schemas — unchanged)
```

## Step 1: Create `services/api/src/chat/tool-executor.ts`

Extract the tool execution closure from route.ts lines 210–461.

```ts
// Dependencies injected via factory function:
type ToolExecutorDeps = {
  db: Database;
  domain: { id: string; slug: string };
  conversationId: string;
  agentId: string;
  chatService: ChatService;         // setConversationStatus, contextMessages
  portalService: PortalService;     // createBooking, createPaymentRequest
  knowledgeService: KnowledgeService; // queryKnowledge
  upsertCustomers: typeof upsertCustomers;
  sendTransactional: typeof sendTransactional;
  escalationNotificationTemplate: typeof escalationNotificationTemplate;
  logger: Logger;
};

export function createToolExecutor(deps: ToolExecutorDeps) {
  return async (name: AgentToolName, args: Record<string, unknown>): Promise<string> => {
    switch (name) {
      case "capture_email": { ... }
      case "book_appointment": { ... }
      case "create_payment": { ... }
      case "sell_product": { ... }
      case "escalate": { ... }
      case "answer_knowledge": { ... }
    }
  };
}
```

## Step 2: Add helper functions to `services/api/src/chat/server.ts`

Move these pure/data-fetching functions from route.ts:

| Function | Lines | Description |
|----------|-------|-------------|
| `systemPromptFor()` | 57–100 | Pure function — builds system prompt from domain, agent, catalog, booking config |
| `getProductCatalog()` | 192–204 | DB query — active products for a domain |
| `getBookingConfig()` | 205–209 | DB query — booking settings for a domain |

These go inside the `createChatService` factory (they use `db` from closure).

## Step 3: Add handler functions to `services/api/src/chat/server.ts`

Move these handler functions from route.ts:

| Function | Lines | Description |
|----------|-------|-------------|
| `handleChatPost()` | 106–530 | POST handler — validates, resolves domain/agent, rate limits, resolves conversation, streams AI response |
| `handleChatConfig()` | 539–563 | GET config — returns domain slug + agent info |
| `handleChatHistory()` | 565–637 | GET history — returns messages or delta stream |
| `streamDelta()` | 649–708 | SSE delta — polls for new messages, pushes as SSE |

These are methods on the chat service object returned by `createChatService`.

## Step 4: Update `services/api/src/chat/index.ts`

Export the new functions:
- `createToolExecutor` from `tool-executor.ts`
- `handleChatPost`, `handleChatConfig`, `handleChatHistory`, `streamDelta`, `CORS_HEADERS`, `jsonError` from `server.ts`

## Step 5: Rewrite `apps/web/app/api/chat/route.ts` as thin wrapper

The route becomes ~80 lines:
- `import { chatService, handleChatPost, handleChatConfig, handleChatHistory, CORS_HEADERS, jsonError } from "@repo/api/chat"`
- Import `aiService`, `logger`, `authService`, `knowledgeService`, `portalService`, `chatRateLimiter` from local services
- `OPTIONS()` — CORS preflight
- `POST()` — delegates to `chatService.handleChatPost(request, { aiService, portalService, knowledgeService, logger, chatRateLimiter })`
- `GET()` — delegates to `chatService.handleChatConfig(request)` or `chatService.handleChatHistory(request, { authService })`

## Dependencies Map

The tool executor needs these external services (injected):
- `db` — database queries (leads, products, bookingSettings, domains, users)
- `chatService.setConversationStatus` — escalate tool
- `chatService.contextMessages` — escalate email (first message)
- `portalService.createBooking` — book_appointment
- `portalService.createPaymentRequest` — create_payment, sell_product
- `knowledgeService.queryKnowledge` — answer_knowledge
- `upsertCustomers` — capture_email
- `sendTransactional` + `escalationNotificationTemplate` — escalate email

The handler functions need:
- `aiService` — streamChat for POST handler
- `chatRateLimiter` — rate limiting for POST handler
- `authService.getSession` — GET history (owner mode)

## Files Modified
1. `services/api/src/chat/tool-executor.ts` — NEW
2. `services/api/src/chat/server.ts` — ADD ~400 lines (systemPromptFor, handlers, streamDelta)
3. `services/api/src/chat/schemas.ts` — UNCHANGED
4. `services/api/src/chat/index.ts` — ADD exports
5. `apps/web/app/api/chat/route.ts` — REDUCE from 708 → ~80 lines

## Verification
- `pnpm --filter @repo/api check-types`
- `pnpm --filter web check-types`
- `pnpm --filter web lint`
- Test widget chat: POST to `/api/chat` with embed secret → should stream AI response
- Test widget config: GET `/api/chat` with embed secret → should return domain + agent
- Test message history: GET `/api/chat?conversationId=xxx` → should return messages
