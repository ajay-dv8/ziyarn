/** The shapes the chat API speaks. Kept in one place so every shell agrees. */

export type AgentToolName =
  | "answer_knowledge"
  | "book_appointment"
  | "create_payment"
  | "sell_product"
  | "escalate";

export interface AgentProduct {
  name: string;
  priceCents: number;
  currency: string;
  imageUrl?: string | null;
  /** Owner-supplied product page; null means no page action. */
  productUrl?: string | null;
  /** Owner-supplied marketing copy; shown in the fullscreen product viewer. */
  description?: string | null;
}

export interface AgentLocation {
  id: string;
  label: string;
  address: string;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Owner-pasted Google Maps link, used when no exact pin was parsed. */
  mapsUrl?: string | null;
  /** Google Place ID, when the pasted link carried one. */
  placeId?: string | null;
  isPrimary?: boolean;
}

export interface AgentConfig {
  domain?: { slug?: string | null; logoUrl?: string | null } | null;
  agent?: { name?: string | null; description?: string | null } | null;
  placeholders?: string[] | null;
  businessType?: string | null;
  knowledgeSearch?: boolean;
  /** Saved business locations; the widget resolves `[[location: id|label]]`. */
  locations?: AgentLocation[] | null;
  widgetVariant?: string;
  /** Which chat trigger opens the chat; ids live in @repo/api chat-triggers. */
  chatTrigger?: string;
  /** Trigger customization (pill label, bubble icon source, tooltip). */
  chatTriggerConfig?: {
    label?: string;
    iconSource?: string;
    tooltip?: string;
    tooltipVisibility?: string;
  } | null;
  /** Active product catalog, used to render recommendation cards in chat. */
  products?: AgentProduct[] | null;
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
