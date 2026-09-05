import OpenAI from "openai";

export const AGENT_TOOLS = [
  "capture_email",
  "book_appointment",
  "create_payment",
  "sell_product",
  "escalate",
  "answer_knowledge",
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number];

export type AiProviderConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export type EmbedProviderConfig = AiProviderConfig & {
  dimensions: number;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ToolExecutor = (
  name: AgentToolName,
  args: Record<string, unknown>,
) => Promise<string>;

export type AiStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: AgentToolName }
  | { type: "escalate" };

const toolParameters = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object" as const,
  properties,
  required,
});

// Tool Description Prompts
// Each tool has a description that acts as a behavioral instruction to the LLM
const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // // Tool definition and prompt for email capturing
  {
    type: "function",
    function: {
      name: "capture_email",
      description:
        "Capture the visitor's email when they want a quote, a callback, or info sent to them. Use it exactly once per need. Include answers to the business's filter questions (from the system prompt) when they have been collected.",
      parameters: toolParameters(
        {
          email: { type: "string", description: "The visitor's email address" },
          name: {
            type: "string",
            description: "The visitor's name, if they shared it",
          },
          purpose: {
            type: "string",
            enum: ["quote", "callback", "info", "other"],
            description: "Why the email is being captured",
          },
          answers: {
            type: "array",
            description: "Answers to the business's filter questions, if any were asked",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
              },
              required: ["question", "answer"],
            },
          },
        },
        ["email", "purpose"],
      ),
    },
  },

  // Tool definition and prompt for booking
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book an appointment/meeting with the visitor. Collect the preferred date and time before calling.",
      parameters: toolParameters(
        {
          date: { type: "string", description: "Preferred date, YYYY-MM-DD" },
          time: { type: "string", description: "Preferred time, HH:MM (24h)" },
          topic: { type: "string", description: "Optional meeting topic" },
        },
        ["date", "time"],
      ),
    },
  },
  // Tool definition and prompt for payment creation
  {
    type: "function",
    function: {
      name: "create_payment",
      description:
        "Create a payment request for a product or service the visitor agreed to buy.",
      parameters: toolParameters(
        {
          amount: { type: "number", description: "Amount to charge" },
          currency: {
            type: "string",
            enum: ["USD", "EUR", "GBP"],
            description: "ISO currency code",
          },
          description: { type: "string", description: "What is being paid for" },
        },
        ["amount", "currency"],
      ),
    },
  },

  // Tool definition and prompt for product sales
  {
    type: "function",
    function: {
      name: "sell_product",
      description:
        "Sell an item already in the business's product catalog once the visitor agrees to buy it. The catalog (names + prices) is listed in the system prompt; never invent a product that is not there. Call create_payment instead for custom/one-off amounts not in the catalog.",
      parameters: toolParameters(
        {
          product: {
            type: "string",
            description: "Name of the catalog product the visitor wants to buy",
          },
          quantity: {
            type: "number",
            description: "Optional quantity, defaults to 1",
          },
        },
        ["product"],
      ),
    },
  },
  // Tool definition and prompt for escalating chat to human agent
  {
    type: "function",
    function: {
      name: "escalate",
      description:
        "Escalate the conversation to a human agent when the visitor asks for a human, is frustrated, or the request is out of scope.",
      parameters: toolParameters({}, []),
    },
  },

  // Tool definition and prompt for answering questions about organisation
  {
    type: "function",
    function: {
      name: "answer_knowledge",
      description:
        "Answer a question from the business's knowledge base. Call it whenever the visitor asks about products, pricing, policies or anything factual about the business.",
      parameters: toolParameters(
        { query: { type: "string", description: "The question to look up" } },
        ["query"],
      ),
    },
  },
];

const MAX_TOOL_ROUNDS = 5;

type StreamInput = {
  systemPrompt: string;
  messages: ChatTurn[];
  tools?: AgentToolName[];
  executeTool: ToolExecutor;
  signal?: AbortSignal;
};

async function* streamWith(
  client: OpenAI,
  model: string,
  input: StreamInput,
): AsyncGenerator<AiStreamEvent> {
  const enabledTools =
    input.tools && input.tools.length > 0
      ? TOOL_DEFINITIONS.filter(
          (def) =>
            def.type === "function" &&
            input.tools!.includes(def.function.name as AgentToolName),
        )
      : [];

  const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: input.systemPrompt },
    ...input.messages.map((turn) => ({ ...turn })),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: history,
        ...(enabledTools.length > 0 ? { tools: enabledTools } : {}),
        stream: true,
      },
      { signal: input.signal },
    );

    let content = "";
    const entries: {
      id: string;
      name: string;
      args: string;
      thoughtSignature?: string;
    }[] = [];
    const entryByIndex = new Map<number, (typeof entries)[number]>();

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        yield { type: "text", delta: delta.content };
      }
      for (const toolCall of delta?.tool_calls ?? []) {
        let entry = entryByIndex.get(toolCall.index);
        if (
          !entry ||
          (toolCall.id && entry.id && toolCall.id !== entry.id)
        ) {
          entry = { id: "", name: "", args: "" };
          entryByIndex.set(toolCall.index, entry);
          entries.push(entry);
        }
        // Providers differ: OpenAI fragments both name and args across chunks
        // for one call (append), Gemini repeats the full name+id per chunk and
        // may emit several calls all under the same index (never re-append an
        // already-seen full name, and rotate on a new id above).
        if (toolCall.id) entry.id = toolCall.id;
        if (toolCall.function?.name) {
          const name = toolCall.function.name;
          if (!entry.name.endsWith(name)) entry.name += name;
        }
        if (toolCall.function?.arguments) {
          entry.args += toolCall.function.arguments;
        }
        const extra = (toolCall as { extra_content?: { google?: { thought_signature?: string } } }).extra_content;
        if (extra?.google?.thought_signature) {
          entry.thoughtSignature = extra.google.thought_signature;
        }
      }
    }

    const callList = entries;

    if (content) {
      history.push({ role: "assistant", content });
    }

    if (callList.length === 0) return;

    history.push({
      role: "assistant",
      content: content || null,
      tool_calls: callList.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.args || "{}" },
        ...(c.thoughtSignature
          ? {
              extra_content: {
                google: { thought_signature: c.thoughtSignature },
              },
            }
          : {}),
      })) as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    });

    for (const call of callList) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.args || "{}");
      } catch {
        args = {};
      }
      const name = call.name as AgentToolName;
      const result = await input.executeTool(name, args);
      history.push({
        role: "tool",
        name,
        tool_call_id: call.id,
        content: result,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      yield { type: "tool", name };
      if (name === "escalate") {
        yield { type: "escalate" };
      }
    }
  }
}

export function createAiService(opts: {
  chat: AiProviderConfig;
  fallback?: AiProviderConfig | null;
  embed: EmbedProviderConfig;
}) {
  const chatClient = opts.chat.apiKey
    ? new OpenAI({ apiKey: opts.chat.apiKey, baseURL: opts.chat.baseURL })
    : null;
  const fallbackClient = opts.fallback?.apiKey
    ? new OpenAI({
        apiKey: opts.fallback.apiKey,
        baseURL: opts.fallback.baseURL,
      })
    : null;
  const embedClient = opts.embed.apiKey
    ? new OpenAI({ apiKey: opts.embed.apiKey, baseURL: opts.embed.baseURL })
    : null;

  const chatModels: Array<{ client: OpenAI; model: string }> = [];
  if (chatClient) chatModels.push({ client: chatClient, model: opts.chat.model });
  if (fallbackClient) {
    chatModels.push({
      client: fallbackClient,
      model: opts.fallback!.model,
    });
  }

  return {
    isConfigured: chatClient !== null && embedClient !== null,

    embeddingModel: opts.embed.model,
    embeddingDimensions: opts.embed.dimensions,

    /**
     * Embeds texts with the configured embedding model. Returns one vector
     * per input, each with `embeddingDimensions` components.
     */
    embed: async (texts: string[]): Promise<number[][]> => {
      if (!embedClient) {
        throw new Error("AI service is not configured (missing API key)");
      }
      if (texts.length === 0) return [];
      const response = await embedClient.embeddings.create({
        model: opts.embed.model,
        input: texts,
        dimensions: opts.embed.dimensions,
      });
      return response.data.map((item) => item.embedding);
    },

    /**
     * Streams an assistant reply with tool calling. Text deltas are yielded as
     * `text` events; completed tool invocations as `tool` events; escalation
     * additionally as an `escalate` event. Falls back to the secondary chat
     * provider if the primary fails before any event was yielded.
     */
    async *streamChat(
      input: StreamInput,
    ): AsyncGenerator<AiStreamEvent> {
      if (chatModels.length === 0) {
        throw new Error("AI service is not configured (missing API key)");
      }
      let lastError: unknown = null;
      for (const { client, model } of chatModels) {
        let yielded = false;
        try {
          for await (const event of streamWith(client, model, input)) {
            yielded = true;
            yield event;
          }
          return;
        } catch (error) {
          lastError = error;
          const last = chatModels[chatModels.length - 1];
          if (yielded || !last || last.client === client) {
            throw error;
          }
        }
      }
      throw lastError;
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;
