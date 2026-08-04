import { createAiService } from "@repo/ai";
import { createChatService } from "@repo/api/chat";

import { db } from "@repo/database";

import { logger } from "./logger";

export const chatService = createChatService({ db });

export const aiService = createAiService({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.AI_MODEL ?? "gpt-4o-mini",
});

export { logger };
