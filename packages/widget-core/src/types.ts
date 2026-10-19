/** The shapes the chat API speaks. Kept in one place so every shell agrees. */

export type AgentToolName =
  | "answer_knowledge"
  | "book_appointment"
  | "create_payment"
  | "sell_product"
  | "escalate";

export interface AgentConfig {
  agent?: { name?: string | null; description?: string | null } | null;
  placeholders?: string[] | null;
  businessType?: string | null;
  knowledgeSearch?: boolean;
  widgetVariant?: string;
}

/** One message as the history endpoint returns it. */
export interface HistoryMessage {
  /** Owner replies are tagged with `sender`; the agent with `role`. */
  sender?: "owner" | "visitor" | "agent";
  role?: "user" | "assistant" | "tool" | "system";
  content?: string | null;
  createdAt?: string | null;
}

export interface HistoryResponse {
  conversation?: { id?: string; status?: string } | null;
  messages?: HistoryMessage[] | null;
}

/** Events on the reply stream. */
export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: AgentToolName; args?: Record<string, unknown> }
  | { type: "escalate" }
  | { type: "done"; conversationId?: string; serverTime?: string }
  | { type: "error"; message?: string; code?: string };

/** Events on the owner-reply delta stream. */
export type DeltaEvent =
  | { type: "message"; message?: HistoryMessage }
  | { type: "done"; serverTime?: string }
  | { type: "error" };
