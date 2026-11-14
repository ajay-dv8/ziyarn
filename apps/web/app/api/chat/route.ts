import { createAiService } from "@repo/ai";
import { handleChatPost, handleChatConfig, handleChatHistory, CORS_HEADERS } from "@repo/api/chat";
import { db } from "@repo/database";

import { aiConfigService } from "@/services/ai-config-service";
import {
  aiService,
  chatService,
  logger,
  platformEmbedConfig,
} from "@/services/chat-service";
import { authService } from "@/services/auth-service";
import { readKnowledgeService } from "@/services/knowledge-service";
import { portalService } from "@/services/portal-service";
import { chatRateLimiter } from "@/lib/rate-limit-db";

export const runtime = "nodejs";

/** The widget runs inside arbitrary host pages, so the public API must be cross-origin friendly. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Builds the chat client for a domain that brought its own provider.
 * Null means "use the platform default".
 */
async function resolveAiService(domain: { id: string; ownerId: string }) {
  const provider = await aiConfigService.resolveForDomain(
    domain.id,
    domain.ownerId,
  );
  if (!provider) return null;
  return createAiService({
    chat: provider,
    // No platform fallback for a BYO provider: its owner pays for its calls.
    fallback: null,
    embed: platformEmbedConfig,
  });
}

/**
 * POST /api/chat — streams AI response as SSE.
 * All business logic lives in @repo/api/chat.
 */
export async function POST(request: Request) {
  return handleChatPost(chatService, db, request, {
    aiService,
    resolveAiService,
    portalService,
    knowledgeService: readKnowledgeService,
    chatRateLimiter,
    logger,
  });
}

/**
 * GET /api/chat — message history (conversationId) or widget config (no conversationId).
 * All business logic lives in @repo/api/chat.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const hasConversationId = url.searchParams.get("conversationId");

  if (!hasConversationId) {
    return handleChatConfig(chatService, request, { logger });
  }

  return handleChatHistory(chatService, request, { authService, logger });
}
