import { CHAT_PATH } from "@repo/routes";
import { createStore, newVisitorId } from "@repo/widget-core/store";
import { createTransport, type Transport } from "@repo/widget-core/transport";
import type {
  AgentConfig,
  DeltaEvent,
  HistoryMessage,
  HistoryResponse,
  StreamEvent,
} from "@repo/widget-core/types";

/**
 * A conversation: who is talking, what has been said, and the two streams the
 * chat runs on.
 *
 * This owns every decision that is *not* about pixels — when to send, when to
 * stop, when to reconnect, which id to persist. A shell only listens to the
 * callbacks, which is why the same session can serve the custom element, the
 * React package and, later, a native client.
 */

/** The server forgot the conversation; a fresh one is worth one retry. */
export class StaleConversationError extends Error {}

export interface SessionConfig {
  /** API origin, e.g. "https://app.ziyarn.com", or "" for same-origin. */
  apiBase: string;
  /** The domain's embed secret. */
  secret: string;
  slug: string;
}

export interface SendHandlers {
  onDelta(delta: string): void;
  onTool(name: string, args?: Record<string, unknown>): void;
  onEscalate(): void;
  onDone(conversationId: string | null): void;
  onError(message: string): void;
  /** Called for every event, including ones the shell has no bubble for. */
  onTick?(): void;
  /** The server goes quiet for this long mid-reply: give up on this turn. */
  inactivityTimeoutMs?: number;
}

export interface OwnerReply {
  sender?: string;
  content?: string | null;
  createdAt?: string | null;
}

export interface Session {
  readonly visitorId: string;
  readonly conversationId: string | null;
  readonly streaming: boolean;
  /** The agent's config — header, placeholders, and a live secret check. */
  loadConfig(): Promise<AgentConfig>;
  /** The saved conversation, or null when there is none. */
  loadHistory(): Promise<HistoryResponse | null>;
  /** Starts listening for a human teammate's replies. Idempotent. */
  listenForOwnerReplies(handlers: { onMessage(message: OwnerReply): void }): void;
  stopListening(): void;
  /** Sends a message and streams the reply. Resolves when the turn is over. */
  send(text: string, handlers: SendHandlers): Promise<void>;
  /** Aborts the turn in flight, if any. */
  stop(): void;
}

const DEFAULT_INACTIVITY_MS = 90_000;
const OWNER_REPLY_RETRY_MS = 2_500;
const OWNER_REPLY_RECONNECT_MS = 200;

export function createSession(config: SessionConfig): Session {
  const transport: Transport = createTransport({
    apiBase: config.apiBase,
    secret: config.secret,
  });
  const store = createStore(config.slug);

  const visitorId = store.load("visitor") ?? newVisitorId();
  store.save("visitor", visitorId);

  let conversationId: string | null = store.load("conversation");
  /** Newest message seen; the delta stream asks for anything after it. */
  let lastMessageAt: Date | null = null;
  let streaming = false;
  let abort: AbortController | null = null;

  let listening = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let ownerHandlers: { onMessage(message: OwnerReply): void } | null = null;

  const rememberTime = (value?: string | null) => {
    if (!value) return;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) lastMessageAt = new Date(parsed);
  };

  const rememberNewest = (messages: HistoryMessage[]) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const createdAt = messages[index]?.createdAt;
      if (createdAt) {
        rememberTime(createdAt);
        return;
      }
    }
  };

  function schedule(delay: number) {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (ownerHandlers) listen(ownerHandlers);
    }, delay);
  }

  /**
   * Long-polls for a human reply, then reconnects immediately: the server
   * closes the stream when there is nothing new, so a short reconnect is the
   * loop. Errors back off, because a down server would otherwise be polled
   * twice a second forever.
   */
  function listen(handlers: { onMessage(message: OwnerReply): void }) {
    if (listening || !conversationId || !lastMessageAt) return;
    listening = true;
    ownerHandlers = handlers;

    const path =
      `${CHAT_PATH}?conversationId=${encodeURIComponent(conversationId)}` +
      `&since=${encodeURIComponent(lastMessageAt.toISOString())}&stream=1`;

    transport
      .streamGet(path)
      .then((source) =>
        transport.readEvents<DeltaEvent>(source, (event) => {
          if (event.type === "message" && event.message) {
            handlers.onMessage(event.message);
            rememberTime(event.message.createdAt);
            return;
          }
          listening = false;
          if (event.type === "done") rememberTime(event.serverTime);
          schedule(
            event.type === "error"
              ? OWNER_REPLY_RETRY_MS
              : OWNER_REPLY_RECONNECT_MS,
          );
        }),
      )
      .catch(() => {
        listening = false;
        schedule(OWNER_REPLY_RETRY_MS);
      });
  }

  async function postMessage(
    text: string,
    signal: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      return await transport.stream(
        CHAT_PATH,
        {
          message: text,
          visitorId,
          conversationId: conversationId ?? undefined,
        },
        signal,
      );
    } catch (error) {
      if (error instanceof Error && error.name === "StaleConversation") {
        throw new StaleConversationError(error.message);
      }
      throw error;
    }
  }

  async function runTurn(
    text: string,
    handlers: SendHandlers,
    onTick: () => void,
  ): Promise<void> {
    const source = await postMessage(text, abort!.signal);

    await transport.readEvents<StreamEvent>(source, (event) => {
      onTick();
      handlers.onTick?.();

      if (event.type === "text") {
        handlers.onDelta(event.delta);
        return;
      }
      if (event.type === "tool") {
        handlers.onTool(event.name, event.args);
        return;
      }
      if (event.type === "escalate") {
        handlers.onEscalate();
        return;
      }
      if (event.type === "error") {
        handlers.onError(event.message ?? "Something went wrong");
        return;
      }
      // done
      if (event.conversationId) {
        conversationId = event.conversationId;
        store.save("conversation", event.conversationId);
      }
      rememberTime(event.serverTime ?? new Date().toISOString());
      handlers.onDone(event.conversationId ?? conversationId);
    });
  }

  return {
    get visitorId() {
      return visitorId;
    },
    get conversationId() {
      return conversationId;
    },
    get streaming() {
      return streaming;
    },

    async loadConfig() {
      return transport.json<AgentConfig>(CHAT_PATH);
    },

    async loadHistory() {
      if (!conversationId) return null;
      const history = await transport.json<HistoryResponse>(
        `${CHAT_PATH}?conversationId=${encodeURIComponent(conversationId)}`,
      );
      rememberNewest(history.messages ?? []);
      return history;
    },

    listenForOwnerReplies(handlers) {
      listen(handlers);
    },

    stopListening() {
      listening = false;
      ownerHandlers = null;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    },

    async send(text, handlers) {
      if (streaming) return;
      streaming = true;
      abort = new AbortController();

      // The server holds a stream open for up to 90s; if nothing arrives for
      // that long the turn is over whatever the socket says.
      const inactivityMs =
        handlers.inactivityTimeoutMs ?? DEFAULT_INACTIVITY_MS;
      let inactivity: ReturnType<typeof setTimeout> | null = null;
      const resetInactivity = () => {
        if (inactivity) clearTimeout(inactivity);
        inactivity = setTimeout(() => {
          abort?.abort();
          handlers.onError("Response timed out. Please try again.");
        }, inactivityMs);
      };
      resetInactivity();

      try {
        await runTurn(text, handlers, resetInactivity);
      } catch (error) {
        if (error instanceof StaleConversationError) {
          // Start a fresh conversation and try once more.
          conversationId = null;
          lastMessageAt = null;
          store.save("conversation", "");
          resetInactivity();
          await runTurn(text, handlers, resetInactivity);
        } else if (!abort?.signal.aborted) {
          handlers.onError(
            error instanceof Error ? error.message : "Something went wrong",
          );
        }
      } finally {
        if (inactivity) clearTimeout(inactivity);
        streaming = false;
        abort = null;
      }
    },

    stop() {
      abort?.abort();
    },
  };
}
