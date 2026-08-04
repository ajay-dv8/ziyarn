import OpenAI from "openai";

export const AGENT_TOOLS = [
  "capture_email",
  "book_appointment",
  "create_payment",
  "escalate",
  "answer_knowledge",
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number];

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

export function createAiService(opts: { apiKey?: string; model?: string }) {
  const client = opts.apiKey ? new OpenAI({ apiKey: opts.apiKey }) : null;
  const model = opts.model ?? "gpt-4o-mini";

  return {
    isConfigured: client !== null,

    /**
     * Streams an assistant reply with tool calling. Text deltas are yielded as
     * `text` events; completed tool invocations as `tool` events; escalation
     * additionally as an `escalate` event.
     */
    async *streamChat(input: {
      systemPrompt: string;
      messages: ChatTurn[];
      tools?: AgentToolName[];
      executeTool: ToolExecutor;
      signal?: AbortSignal;
    }): AsyncGenerator<AiStreamEvent> {
      if (!client) {
        throw new Error("AI service is not configured (missing API key)");
      }

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
        const calls: Record<number, { id: string; name: string; args: string }> =
          {};

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
          })),
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
            tool_call_id: call.id,
            content: result,
          });
          yield { type: "tool", name };
          if (name === "escalate") {
            yield { type: "escalate" };
          }
        }
      }
    },
  };
}

export type AiService = ReturnType<typeof createAiService>;
