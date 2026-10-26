import { handleChatEscalate, CORS_HEADERS } from "@repo/api/chat";
import { db } from "@repo/database";

import { chatService, logger } from "@/services/chat-service";

export const runtime = "nodejs";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/chat/escalate — visitor-initiated handoff to a human agent.
 *
 * Called by the widget when the AI model is unavailable or its tokens are
 * exhausted, so the visitor can move the conversation to a human teammate
 * instead of staring at a dead chat.
 */
export async function POST(request: Request) {
  return handleChatEscalate(request, {
    db,
    chatService,
    logger,
  });
}
