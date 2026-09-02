import { handleChatPost, handleChatConfig, handleChatHistory, CORS_HEADERS } from "@repo/api/chat";
import { db } from "@repo/database";

import { aiService, chatService, logger } from "@/services/chat-service";
import { authService } from "@/services/auth-service";
import { knowledgeService } from "@/services/knowledge-service";
import { portalService } from "@/services/portal-service";
import { chatRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** The widget runs inside arbitrary host pages, so the public API must be cross-origin friendly. */
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/chat — streams AI response as SSE.
 * All business logic lives in @repo/api/chat.
 */
export async function POST(request: Request) {
  return handleChatPost(chatService, db, request, {
    aiService,
    portalService,
    knowledgeService,
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
