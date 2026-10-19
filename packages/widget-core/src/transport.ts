/**
 * The widget's HTTP layer: one request helper and one SSE reader.
 *
 * Nothing here knows about the DOM, so the same code serves the custom element,
 * the React package and any future native client.
 */

export interface TransportConfig {
  /** API origin, e.g. "https://app.ziyarn.com" or "" for same-origin. */
  apiBase: string;
  /** The domain's embed secret. Sent on every request; it authorises the
   *  domain, not a person. */
  secret: string;
}

export interface Transport {
  /** GET/POST JSON. Throws an Error carrying the server's message. */
  json<T>(path: string, init?: RequestInit): Promise<T>;
  /** POST and read the response as a server-sent event stream. */
  stream(path: string, body: unknown, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
  /** GET a server-sent event stream — the owner-reply delta endpoint. */
  streamGet(path: string): Promise<ReadableStream<Uint8Array>>;
  /** Read an SSE stream, handing each parsed event to `onEvent`. Resolves when
   *  the stream closes. Malformed events are skipped, never thrown. */
  readEvents<T>(
    stream: ReadableStream<Uint8Array>,
    onEvent: (event: T) => void,
  ): Promise<void>;
}

export function createTransport({ apiBase, secret }: TransportConfig): Transport {
  const url = (path: string) => `${apiBase}${path}`;

  const headers = () => ({
    "x-embed-secret": secret,
  });

  async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url(path), {
      ...init,
      headers: { ...headers(), ...(init.headers as Record<string, string>) },
    });

    if (!response.ok) {
      // The API answers `{ error: { code, message } }`; fall back to the status
      // so a proxy's HTML error page still produces a readable message.
      const payload = await response.json().catch(() => ({}));
      const message =
        (payload as { error?: { message?: string } })?.error?.message ??
        `Request failed (${response.status})`;
      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  const bodyOf = async (response: Response) => {
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      const error = (payload as { error?: { code?: string; message?: string } })
        ?.error;
      const failure = new Error(
        error?.message ?? `Request failed (${response.status})`,
      );
      // The server forgot this conversation. Worth one retry as a fresh one.
      if (error?.code === "NOT_FOUND") failure.name = "StaleConversation";
      throw failure;
    }
    return response.body;
  };

  function stream(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    return fetch(url(path), {
      method: "POST",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }).then(bodyOf);
  }

  function streamGet(path: string): Promise<ReadableStream<Uint8Array>> {
    return fetch(url(path), {
      method: "GET",
      headers: headers(),
    }).then(bodyOf);
  }

  async function readEvents<T>(
    source: ReadableStream<Uint8Array>,
    onEvent: (event: T) => void,
  ): Promise<void> {
    const reader = source.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Frames are separated by a blank line; each line is `data: {json}`.
    const pump = (): Promise<void> =>
      reader.read().then(({ done, value }) => {
        if (done) return undefined;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n")[0] ?? "";
          if (!line.startsWith("data:")) continue;
          try {
            onEvent(JSON.parse(line.slice(5).trim()) as T);
          } catch {
            /* a malformed frame must not kill the stream */
          }
        }
        return pump();
      });

    return pump();
  }

  return { json, stream, streamGet, readEvents };
}
