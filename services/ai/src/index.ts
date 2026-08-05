import OpenAI from "openai";

export const AGENT_TOOLS = [
  "capture_email",
  "book_appointment",
  "create_payment",
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

const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "capture_email",
      description:
        "Capture the visitor's email when they want a quote, a callback, or info sent to them. Use it exactly once per need.",
      parameters: toolParameters(
        {
          email: { type: "string", description: "The visitor's email address" },
          purpose: {
            type: "string",
            enum: ["quote", "callback", "info", "other"],
            description: "Why the email is being captured",
          },
        },
        ["email", "purpose"],
      ),
    },
  },
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
  {
    type: "function",
    function: {
      name: "escalate",
      description:
        "Escalate the conversation to a human agent when the visitor asks for a human, is frustrated, or the request is out of scope.",
      parameters: toolParameters({}, []),
    },
  },
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
    const calls: Record<
      number,
      { id: string; name: string; args: string; thoughtSignature?: string }
    > = {};

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        yield { type: "text", delta: delta.content };
      }
      for (const toolCall of delta?.tool_calls ?? []) {
        const entry = (calls[toolCall.index] ??= {
          id: "",
          name: "",
          args: "",
        });
        if (toolCall.id) entry.id = toolCall.id;
        if (toolCall.function?.name) entry.name += toolCall.function.name;
        if (toolCall.function?.arguments) {
          entry.args += toolCall.function.arguments;
        }
        const extra = (toolCall as { extra_content?: { google?: { thought_signature?: string } } }).extra_content;
        if (extra?.google?.thought_signature) {
          entry.thoughtSignature = extra.google.thought_signature;
        }
      }
    }

    const callList = Object.values(calls);

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
