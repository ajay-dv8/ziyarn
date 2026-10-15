# Voice Plan — Speech Input & Output for the Widget and Agent

Goal: let a site visitor **speak** to the embedded Ziyarn agent and **hear** the
reply, and let each owner configure their agent's voice (language, tone, brand
voice) from the dashboard.

Extends `plan/rebuild_divesai.md` as **P14–P18**. Nothing here changes the
existing text chat path — voice is opt-in, additive, and degrades to today's
behavior when disabled or unsupported.

---

# 1 Why this matters for Ziyarn

The current widget is text-only. That excludes a large slice of the target
market and, more importantly, it is the wrong default for the markets Ziyarn
actually sells into (GHS default currency, Paystack checkout, Ghana/Nigeria
first):

- **Hands-free beats typing** for field sales, market traders, clinic queues,
  restaurant counters, and anyone driving or carrying something.
- **Low literacy / low typing fluency** — speaking is the natural interface.
- **Noisy, mobile-first networks** — a 3-second voice turn is faster than
  typing 20 characters on a cracked screen keyboard.
- **Local languages are a differentiator.** Gemini TTS supports **130+
  languages including Akan, Ganda, Hausa, Igbo, and Nigerian Fulfulde**.
  Competing helpdesk bots are English-only. A Twi- or Hausa-speaking agent for
  a Ghanaian or Nigerian business is a pitch no competitor can match today.

This is the single highest-leverage differentiator available to Ziyarn right
now, and it rides on **credentials we already have** (`GEMINI_API_KEY`) and an
**SSE transport we already stream on**.

---

# 2 Architecture decision

Three shapes are possible. We pick one, not a blend, per phase.

## Option A — Browser-native Web Speech API

`SpeechRecognition` / `webkitSpeechRecognition` for STT,
`speechSynthesis` for TTS.

| Pros | Cons |
|---|---|
| Zero server cost | STT is Chrome/Edge/Safari only — **no Firefox** |
| Zero added latency | Sends raw audio to Google servers — not owner-compliant, breaks the "gate every boundary" principle |
| No new code path | **TTS voices are OS-installed.** A Ghanaian Android almost certainly has no Akan voice. Quality is unusable for the target market |
| Works offline (TTS) | Cannot enforce a brand voice; no custom vocabulary; no server-side cost control |

**Verdict: rejected as the primary path.** Kept only as an optional
progressive-enhancement fallback in Phase 1 for browsers where `MediaRecorder`
is unavailable (see §5.4).

## Option B — Server-side Gemini STT + Gemini TTS over the existing SSE ✅ CHOSEN

Audio is captured in the browser, transcribed and synthesized on the server by
Gemini, and streamed back on the **same SSE connection** the text reply already
uses.

| Pros | Cons |
|---|---|
| Works in **every** browser (only needs `MediaRecorder`, universally supported) | Per-character cost — must be plan-gated |
| Akan / Hausa / Igbo supported server-side | Adds ~300–600 ms before the first sentence is audible |
| **No new provider** — `GEMINI_API_KEY` already configured | Two concurrent Gemini calls per turn (text + speech) |
| Owner-configurable brand voice, style, language | Bandwidth cost of streaming audio |
| `custom_vocabulary` from the catalog → large accuracy win | |
| Full control: sanitize markdown before speaking, cap length, gate by plan | |

**Verdict: chosen.** It reuses the existing transport, the existing provider,
and the existing plan-gating machinery.

## Option C — Gemini Live API (full-duplex audio)

`gemini-3.5-transcribe-live` + native audio dialogue, true barge-in,
lowest possible latency.

| Pros | Cons |
|---|---|
| Real full-duplex, interruption handling | **Requires WebSocket.** Vercel serverless functions cannot hold a long-lived socket |
| Best-in-class latency | Needs a separate long-lived service (Fluid Compute / Cloudflare Durable Object / Fly.io) — new infra, new deploy, new cost line |
| | Token/latency behaviour of the existing SSE chat pipeline would need a parallel realtime implementation |

**Verdict: deferred to Phase 5**, gated on infra. Documented here so the
decision is on record and the migration path from Option B is clear (the
`voice` SSE events are a strict subset of what Live API would emit).

## Transport shape (Option B, concretely)

```
Widget                                     Ziyarn
  |                                          |
  |-- POST /api/voice/transcribe ----------> |  Gemini gemini-3.5-transcribe
  |    (multipart audio blob)                |    + custom_vocabulary + smart mode
  |<-- { text, language } ------------------ |
  |                                          |
  |-- POST /api/chat (SSE) ---------------> |  Gemini gemini-3.x-flash (text)
  |<-- data: {type:"text",  delta:"..."} --- |     │
  |                                          |  sentence boundary hit
  |                                          |-- Gemini gemini-3.8-flash-lite-tts
  |<-- data: {type:"speech", id, text} ------ |  (stream:true)
  |<-- data: {type:"audio",  id, chunk} ----- |     │
  |    ... interleaved ...                   |     │
  |<-- data: {type:"done",  serverTime} ----- |
```

**Text and audio interleave on one stream.** No second round trip, no separate
audio endpoint for the reply path. The widget renders text exactly as it does
today and *additionally* queues audio chunks as they arrive. First audio starts
playing ~300–600 ms after the first sentence completes — while the text is
still streaming.

---

# 3 Data model

## 3.1 Migration

`agents` gains one `jsonb` column. Follows the existing `agents.filter_questions`
precedent (and the `leads.answers` precedent) — the eight fields are always read
together and never queried by SQL, so a jsonb blob beats eight columns.

```sql
ALTER TABLE agents ADD COLUMN voice_settings jsonb;
```

Next migration number is **`0027_agents_voice_settings.sql`** — see §12 for the
journal caveat (this repo hand-writes migrations; `0025` and `0027`-adjacent
files are not in `_journal.json`).

## 3.2 Shape

Stored `null` = voice off. This means existing agents are unaffected and the
migration is a no-op for current rows.

```ts
// services/api/src/voice/schemas.ts
export const voiceSettingsSchema = z.object({
  /** Master switch. When false the widget never renders mic or speaker. */
  enabled: z.boolean(),
  /** off = never speak · read_aloud = visitor taps the speaker · auto = always speak. */
  mode: z.enum(["off", "read_aloud", "auto"]),
  /** Gemini prebuilt voice name (e.g. "Sulafat") or a custom `voice_...` id. */
  voiceId: z.string().trim().max(120).default("Sulafat"),
  /** BCP-47 hint. Empty string = let Gemini auto-detect the reply language. */
  language: z.string().trim().max(20).default(""),
  /** Fed to `speech_metadata.style`. Free text, max 200 chars. */
  style: z.string().trim().max(200).default(""),
  /** Speech-to-text toggle — independent of the output switch. */
  sttEnabled: z.boolean().default(false),
  /** BCP-47 hint for transcription. Empty = auto-detect + code-switch. */
  sttLanguage: z.string().trim().max(20).default(""),
  /** `custom_vocabulary` terms. ≤ 100 lines, ≤ 60 chars each. */
  sttVocabulary: z.array(z.string().trim().min(1).max(60)).max(100).default([]),
  /** Owner opt-in to send a hint so the voice matches their accent. */
  autoSpeakLinks: z.boolean().default(false),
});

export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

/** Used when `voice_settings` is NULL. */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: false,
  mode: "off",
  voiceId: "Sulafat",
  language: "",
  style: "",
  sttEnabled: false,
  sttLanguage: "",
  sttVocabulary: [],
  autoSpeakLinks: false,
};
```

## 3.3 Plan limits

TTS and STT cost real money per character and per second. **This must be
gated**, or the free plan becomes an unbounded burn — exactly the defect the
divesai rebuild set out to kill ("no unlimited OpenAI burn").

Add to `PlanLimits` in `services/api/src/plans/server.ts` (the single source of
truth — never re-declare limits elsewhere):

```ts
/** Voice turns (one visitor message + its spoken reply) per month, all domains. */
voiceTurnsPerMonth: number;
/** Spoken characters synthesized per month, all domains. */
speechCharactersPerMonth: number;
/** Transcription requests per month. */
transcriptionsPerMonth: number;
/** Hard cap on a single transcription upload, seconds. */
maxTranscriptionSeconds: number;
```

Suggested values:

| | free | standard (Plus) | pro (Business) | ultimate (Enterprise) | custom |
|---|---|---|---|---|---|
| `voiceTurnsPerMonth` | 0 | 2 000 | 25 000 | 250 000 | ∞ |
| `speechCharactersPerMonth` | 0 | 150 000 | 2 000 000 | 20 000 000 | ∞ |
| `transcriptionsPerMonth` | 0 | 3 000 | 40 000 | 400 000 | ∞ |
| `maxTranscriptionSeconds` | 30 | 120 | 300 | 600 | 300 |

`assertCanUseVoice(...)` and `assertCanTranscribe(...)` throw
`PlanLimitError(429, "VOICE_PLAN_LIMIT_EXCEEDED", ...)` — same shape as
`assertCanCreateProduct`.

---

# 4 Phase 0 — AI layer (`services/ai`)

## 4.1 The problem

`services/ai` is built entirely on the `openai` SDK pointed at an
OpenAI-compatible base URL. **Gemini's TTS and transcription are NOT on the
OpenAI-compatible surface.** They live on the Interactions API:

```
POST https://generativelanguage.googleapis.com/v1beta/interactions
```

So voice needs a **new code path using raw `fetch`**. This is not a new idea
for the repo — `services/api/src/paystack/server.ts` already uses raw `fetch`
with an `AbortController` and carries a comment explaining why the official SDK
was rejected. Follow that precedent exactly.

## 4.2 New file: `services/ai/src/voice.ts`

```ts
export type SpeechChunk = { base64: string };

export type SynthesizeOptions = {
  text: string;
  voiceId: string;
  /** BCP-47 or "" for auto-detect. */
  language: string;
  /** Feeds `speech_metadata.style`. */
  style?: string;
  /** Must match `EMBEDDING_DIMENSIONS`-style config the client decodes with. */
  sampleRate?: number;
  signal?: AbortSignal;
};

export type SynthesizeResult = {
  audioBase64: string;
  mimeType: string;
  sampleRate: number;
  channels: number;
};

export type TranscribeOptions = {
  /** Base64-encoded audio bytes. */
  audioBase64: string;
  mimeType: string;
  /** BCP-47 hints. Empty = auto-detect + code-switch. */
  languageCodes: string[];
  /** `custom_vocabulary` — ≤ 100 entries for best results. */
  vocabulary: string[];
  signal?: AbortSignal;
};

export type TranscribeResult = {
  text: string;
  /** BCP-47 when Gemini reports it, else null. */
  language: string | null;
};
```

Export from `services/ai/src/index.ts`:

```ts
export {
  synthesizeSpeech,
  transcribeAudio,
  PREBUILT_VOICES,
  type SynthesizeOptions,
  type SynthesizeResult,
  type TranscribeResult,
  type TranscribeOptions,
} from "@repo/ai/voice";
```

## 4.3 `synthesizeSpeech` — streaming TTS

Request (`stream: true` returns headerless raw PCM, which is exactly what we
want to forward):

```ts
const response = await fetch(`${baseUrl}/v1beta/interactions`, {
  method: "POST",
  headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
  body: JSON.stringify({
    model: ttsModel,
    input: [
      {
        type: "user_input",
        content: [
          {
            type: "text",
            text: options.text,
            annotations: options.style
              ? [{ type: "speech_metadata", style: options.style }]
              : [],
          },
        ],
      },
    ],
    response_format: {
      type: "audio",
      mime_type: "audio/l16",
      sample_rate: options.sampleRate ?? 24000,
    },
    generation_config: { speech_config: [{ voice: options.voiceId }] },
    stream: true,
  }),
  signal: options.signal,
});
```

Then read `response.body`, parse the streamed `step.delta` events with
`delta.type === "audio"`, and yield base64 chunks.

**Streaming output format note:** `stream: true` returns headerless
`audio/l16` (24 kHz, mono, signed 16-bit LE) by default — **no WAV header**.
This is deliberate and ideal: chunks concatenate and play continuously with no
per-chunk header. The client therefore needs the sample rate and channel count,
so **both must be returned from the service and forwarded to the client**
(`SynthesizeResult`). Hard-code them as constants in the widget only after the
service contract is locked.

> **Bandwidth decision (deferred).** `audio/l16` @ 24 kHz mono is 48 KB/s
> (~2 MB for a 40 s reply) before base64's +33 %. For mobile-first Ghana/Nigeria
> this is the main risk. The API also supports `audio/mulaw` / `audio/alaw`
> (8-bit G.711) which at 8 kHz is 8 KB/s — **6× smaller, telephony grade**.
> Phase 2 ships `audio/l16`; add a `VOICE_AUDIO_FORMAT=mulaw|l16` env switch in
> Phase 6 with a small G.711 decoder in the widget. Do not block the launch on it.

## 4.4 `transcribeAudio` — speech to text

Inline base64 for short clips (a hands-free turn is 3–15 s). The Files API
upload is unnecessary at this size and adds a round trip.

```ts
{
  model: sttModel,
  input: [{ type: "audio", data: options.audioBase64, mime_type: options.mimeType }],
  generation_config: {
    transcription_config: {
      language_codes: options.languageCodes,   // [] = auto-detect
      ...(options.vocabulary.length
        ? { custom_vocabulary: options.vocabulary.slice(0, 100) }
        : {}),
      mode: "smart",   // strips "um"/"uh"/false starts — essential before TTS reads it back
    },
  },
}
```

Three decisions that matter:

- **`mode: "smart"`** — disfluency removal and inline self-correction. A visitor
  saying *"Tuesday — actually, Wednesday — at two"* becomes *"Wednesday at
  2 PM"*. Verbatim mode would send that straight to the LLM and then TTS would
  read it aloud. **Non-negotiable.**
- **`custom_vocabulary`** — seeded from the domain's **active product names**,
  the domain name, and the agent name. This is the single biggest accuracy win
  available: "do you have the *Kente Print Maxi* in size large" stops becoming
  "do you have the *can’t print Maxi* in size large". Must be assembled from the
  catalog in `chat/server.ts`, which already calls `getProductCatalog(domain.id)`.
- **`custom_vocabulary` is incompatible with diarization and word timestamps.**
  We want neither, so no conflict.

## 4.5 Models & env

| Purpose | Env var | Default | Note |
|---|---|---|---|
| TTS | `GEMINI_TTS_MODEL` | `gemini-3.8-flash-lite-tts` | Google explicitly recommends Flash-Lite for "conversational voice agent cascades". Use `gemini-3.8-flash-tts` for expressive/brand voices |
| STT | `GEMINI_STT_MODEL` | `gemini-3.5-transcribe` | |
| TTS sample rate | `VOICE_SAMPLE_RATE` | `24000` | |
| Kill switch | `VOICE_ENABLED` | `true` | Global off-switch, does not touch agent config |
| Transcript cap | `VOICE_MAX_TRANSCRIPT_BYTES` | `5242880` | 5 MB |

Add all five to `turbo.json` `globalEnv` (single-line array — keep it tidy).

## 4.6 Curated voice list

Do **not** ship all 30 prebuilt voices in a dropdown. Ship a curated
`PREBUILT_VOICES` array in `services/ai/src/voice.ts` with the voice's
character from Google's docs (Zephyr *Bright*, Kore *Firm*, Puck *Upbeat*,
Sulafat *Warm*, Sulafat's… etc.), plus a "browse the full library" affordance
that calls `GET /v1beta/voices?language_code=<lang>&context=Conversational`
server-side and caches the result for the process.

A **warm, professional** default matters for the brand commitment ("clean,
modern, professional: precise, confident, no hype"). `Sulafat` (*Warm*) and
`Achird` (*Friendly*) are the right defaults for the Ghana/Nigeria audience;
`Kore` (*Firm*) suits finance.

---

# 5 Phase 1 — Speech input (visitor speaks)

## 5.1 Route: `apps/web/app/api/voice/transcribe/route.ts`

`runtime = "nodejs"`, `maxDuration = 30`.

Mirror `handleChatPost`'s auth exactly — `x-embed-secret` header → 401
`MISSING_SECRET`, `resolveDomainBySecret` → 403 `FORBIDDEN`.

```
POST /api/voice/transcribe
Headers: x-embed-secret, content-type: multipart/form-data
Body:    domainId (implicit via secret), audio (File)

200 { text: string, language: string | null }
400 INVALID_INPUT        — bad mime, oversize, unparseable form
401 MISSING_SECRET
403 FORBIDDEN
404 NO_AGENT / VOICE_DISABLED
413 AUDIO_TOO_LARGE
429 RATE_LIMITED | VOICE_PLAN_LIMIT_EXCEEDED
503 VOICE_NOT_CONFIGURED  — GEMINI_API_KEY missing
```

`OPTIONS` returns 204 + `CORS_HEADERS` (imported from `@repo/api/chat`) — the
widget runs cross-origin, so this route **must** be CORS-enabled or it is dead
on arrival in production. This is easy to forget.

## 5.2 Rate limiting — a separate limiter

`chatRateLimiter` is keyed `msg:${visitorId}`. Transcripts are a distinct,
more expensive operation and must not share the budget. Add to
`apps/web/lib/rate-limit.ts`:

```ts
const TRANSCRIBE_LIMIT = 10;
const TRANSCRIBE_WINDOW_MS = 60_000;

export const voiceRateLimiter = new SlidingWindowRateLimiter(
  TRANSCRIBE_LIMIT,
  TRANSCRIBE_WINDOW_MS,
);
```

Keyed `stt:${visitorId}`. Note the **existing weakness** carried over from
§2 of the rebuild roadmap: the visitor ID is client-supplied, so it is
trivially rotated. Do not make voice *more* expensive to abuse than chat — the
per-visitor cap plus the plan cap is the defence.

## 5.3 Widget capture

`apps/web/public/widget.js`, inside the Shadow DOM.

```
getUserMedia({ audio: true })
  → MediaRecorder(stream)
      mimeType preference order:
        "audio/webm;codecs=opus"   Chrome/Edge/Firefox/Android
        "audio/webm"
        "audio/mp4"                Safari (produces audio/mp4 — map to audio/m4a server-side)
```

> **Do not use `MediaRecorder.isTypeSupported()` on the full codec string
> blindly** — Firefox rejects `audio/webm;codecs=opus` in some builds. Probe
> each candidate in order and take the first that returns true.

Live feedback while recording: an `AnalyserNode` on the same
`AudioContext` driving a small waveform in the mic button, plus an elapsed-time
label. This is what makes hands-free feel trustworthy — the visitor needs to
know the mic is live.

### ⚠️ Selector bug to avoid

`widget.js:474`:

```js
this._sendBtn = root.querySelector(".zy-composer button");
```

This grabs the **first** button in the composer. Adding a mic button before
the send button silently repoints `_sendBtn` at the mic — sending breaks with
no error. **Give both buttons explicit classes** and select by class:

```js
this._micBtn = root.querySelector(".zy-composer .zy-mic");
this._sendBtn = root.querySelector(".zy-composer .zy-send");
```

Audit every other `querySelector` that relies on document order while you are
in there.

## 5.4 Browser-native fallback (optional, narrow)

If `MediaRecorder` is absent, or `getUserMedia` throws `NotAllowedError`
(mic permission denied, insecure context / non-HTTPS), fall back to the
browser `SpeechRecognition` if present, else show a plain "Type your message"
state. **Do not** make the whole mic button disappear on permission denial —
that reads as a broken product. Show a tooltip explaining how to enable the mic.

Note: browsers only grant `getUserMedia` on **HTTPS** (or `localhost`). The
widget has a `data-api` override, so local HTTP dev against a remote API will
have mic blocked. This is a dev-environment caveat, not a product bug — but it
will bite whoever tests it first, so write it down.

## 5.5 Auto-send

After transcription, fill the input and show it. Provide
`data-autosend` / a settings toggle to send immediately. This is the single
flag that turns the widget from "speech-to-text into a text box" into a
conversation. Default it **on** when `sttEnabled` is on and the visitor has
used voice once.

---

# 6 Phase 2 — Speech output (agent speaks)

## 6.1 Sentence chunking (the crux)

The AI streams text deltas. Sending every token to TTS would be slow, costly,
and prosodically broken. Buffer until a **safe sentence boundary**, then
synthesize and stream.

New pure module: `services/api/src/chat/speech-segment.ts`. Pure TS, no zod,
no I/O — same shape as `email/blocks.ts`.

```ts
export type SegmenterOptions = {
  /** Flush below this many characters we will not emit — wait for more. */
  minChars: number;
  /** Hard flush cap so a runaway sentence always makes progress. */
  maxChars: number;
};

export type Segmenter = {
  /** Feed a text delta. Returns zero or more complete, speakable segments. */
  push(delta: string): string[];
  /** Flush the tail at end-of-turn. */
  flush(): string[];
  /** Reset — called on stream error so a partial tail is never spoken. */
  reset(): void;
};

export function createSegmenter(options: SegmenterOptions): Segmenter;
```

Recommended defaults: `minChars = 40`, `maxChars = 280`.

### 6.2 `speakableText()` — never read markdown aloud

**This is the most important correctness detail in the whole feature.** The AI
replies are rendered through `renderMd()`. Read literally, TTS would say
*"asterisk asterisk Kente Maxi asterisk asterisk"*, *"open bracket one close
bracket"*, and *"h t t p s colon slash slash…"*. That is an instant credibility
destroy for an "AI agent platform".

`speakableText(raw: string): string` must strip, in order:

1. Fenced and inline code (```` ```…``` ````, `` `x` ``) — dropped entirely
2. Markdown links `[label](url)` → `label`; bare autolinks and URLs → dropped
   or replaced with `"the link in the chat"` depending on `autoSpeakLinks`
3. Emphasis `**bold**`, `__bold__`, `*italic*`, `_italic_`, `~~strike~~`
4. Headings `### `, blockquotes `> `, list bullets `- ` / `* ` / `1. `
5. Tables and horizontal rules — dropped
6. `answer_knowledge` citation markers `[1]`, `[2]` — dropped
7. HTML entities → their characters; emoji → dropped
8. Currency is **kept** (`GH₵750.00`) — TTS models handle it, and it is
   information the visitor needs

Add table-driven tests. This function is the difference between "a voice
feature" and "a voice feature that sounds professional".

### 6.3 Boundary detection

`isSentenceBoundary(text)` — split on `.!?…` followed by whitespace, **but
not** when the period is:

- inside a number (`750.00`, `1.5`, `v2.1`)
- an abbreviation (`Mr.`, `Dr.`, `e.g.`, `i.e.`, `vs.`, `St.`, `GH₵.`)
- part of an ellipsis being formed (`...`)
- immediately followed by a lowercase letter or a digit

Emit on newline as a hard boundary (markdown structure implies a pause).

### 6.4 SSE events

Three new event types on the existing `POST /api/chat` stream. The widget's
existing `_readStream` splitter handles them unchanged — they arrive as
ordinary `data: {...}\n\n` frames.

```ts
// Capabilities — sent first, before any text. Lets the widget know whether
// to render the speaker affordance at all.
{ type: "voice", stt: boolean, speak: boolean, language: string }

// A complete speakable sentence, sanitized. Advisory — the widget can ignore it.
{ type: "speech", id: string, text: string }

// Base64 raw PCM chunk for sentence `id`.
{ type: "audio", id: string, chunk: string, final?: boolean }
```

Nothing existing is removed or renamed. `text`, `tool`, `escalate`, `done`,
`error` all behave exactly as today — **a widget running old JS ignores every
voice event and the text chat is unchanged.**

## 6.5 Server wiring in `handleChatPost`

Inside the existing `ReadableStream` (`services/api/src/chat/server.ts`,
around lines 778–830):

```
1. Resolve agent. If !voiceSettings.enabled || mode === "off", run today's
   loop verbatim and skip everything below.
2. send({ type: "voice", stt, speak, language })
3. Run a second AbortController for speech, aborted in the same `finally`.
4. For each AI event:
     text  → append to fullReply AND segmenter.push(delta)
             → for each completed segment:
                   text = speakableText(segment)
                   if (!text) continue
                   id = nanoid-ish (use crypto.randomUUID, sliced)
                   send({ type: "speech", id, text })
                   stream synthesizeSpeech({text, voiceId, style, ...})
                     → for each base64 chunk: send({ type: "audio", id, chunk })
                   appendMessage to the speech buffer
     tool / escalate → send(event) unchanged
5. On "escalate": cancel pending speech immediately. The AI's spoken reply is
   replaced by a human; do not talk over the human.
6. On loop end: flush the segmenter tail through the same path.
7. Record { voice: true, speechChars: N } in the assistant message metadata so
   the Usage page can meter it (same trick as { streamed: true }).
```

**Never let speech block text.** The synthesizer runs concurrently with the
main loop. If TTS fails (429, model unavailable, network), **log and drop it** —
the text reply must still complete and the `done` frame must still fire. Wrap
every speech path in `try/catch`. A voice failure is never a chat failure.

`MAX_TOOL_ROUNDS = 5` is unaffected: speech is downstream of the tool loop and
never changes tool behaviour.

## 6.6 Playing streamed PCM in the widget (no build step)

`apps/web/public/widget.js` is hand-written vanilla JS with **no bundler and no
build step**, served static from `public/`. That rules out bundling an audio
library. It also rules out `AudioWorklet` — a worklet module needs its own URL
(a worker), and customer sites with strict CSP (`script-src 'self'`) block
`blob:` and `data:` workers. Do not ship something that breaks on the host
page.

**Use `AudioContext` + scheduled `AudioBufferSourceNode` on the main thread.**

```js
// Decode one base64 chunk of signed 16-bit LE mono PCM into an AudioBuffer.
function decodePcmChunk(context, int16Array) {
  var buffer = context.createBuffer(1, int16Array.length, SAMPLE_RATE);
  var channel = buffer.getChannelData(0);
  for (var sampleIndex = 0; sampleIndex < int16Array.length; sampleIndex++) {
    // int16Array is already [-32768, 32767]; Web Audio wants [-1, 1].
    channel[sampleIndex] = int16Array[sampleIndex] / 32768;
  }
  return buffer;
}
```

Queue discipline:

- Maintain `this._playhead` (an `AudioContext.currentTime` value), initialised
  to `context.currentTime + 0.05` on first chunk.
- On each chunk: `source.start(this._playhead)`, then
  `this._playhead += buffer.duration`.
- This plays chunk *n+1* exactly as chunk *n* ends — continuous audio with no
  gap and no re-scheduling jitter.
- `SpeechRecognition`-style utterance boundaries do not exist here; segment ids
  give us natural split points if a pause is ever wanted.

Lifecycle: `AudioContext` must be created **lazily on the first user gesture**
(the mic or send tap). Browsers block audio otherwise, and constructing one
eagerly on `connectedCallback` produces a suspended context that silently
produces no sound — a confusing bug to chase.

## 6.7 Widget UX

| Control | Behavior |
|---|---|
| Mic button, idle | Tap → start recording (waveform + timer) |
| Mic button, recording | Tap again → stop and transcribe; or Esc |
| `mode: "read_aloud"` | Speaker button appears under each agent message; tap to replay |
| `mode: "auto"` | Every reply speaks automatically once audio is unlocked |
| Stop-speaking | A small stop control appears while audio is playing; also stops on mic start |
| **Barge-in** | Starting a recording immediately stops playback and clears the queue |

Barge-in is not optional polish. Without it, a visitor cannot interrupt an
agent that is reading a long answer — the single most common complaint about
naive voice widgets.

Autoplay: `mode: "auto"` must not attempt playback before any user gesture.
Track `this._audioUnlocked`, set on the first tap. Until then, render text only
and show the speaker button as if `mode` were `read_aloud`.

---

# 7 Phase 3 — Owner configuration

## 7.1 Service: `services/api/src/voice/`

New module, same triple as every other (`server.ts` / `schemas.ts` /
`index.ts`). Register in `services/api/package.json` `exports`
(`"./voice"` + `"./voice/*"`) — **never a relative `./x.js` import**.

```ts
export function createVoiceService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
  synthesize: typeof synthesizeSpeech;
  transcribe: typeof transcribeAudio;
}) {
  return {
    getVoiceSettings,      // agent owner-scoped
    updateVoiceSettings,   // agent owner-scoped, zod-validated
    previewVoice,          // owner-scoped; synthesizes a fixed sample, returns audio
    listVoices,            // cached GET /v1beta/voices
    createCustomVoice,     // Phase 3b — POST /v1beta/voices { type: "prompted" }
    getMonthlyVoiceUsage,  // for the Usage page
  };
}
```

Export a `VoiceServiceError` with `.status` / `.code` like every other module.
Ownership via a `requireOwnedAgent(agentId, headers)` guard that joins
`agents → domains` and checks `domains.ownerId` — **identical to the guard
already in `agents/server.ts`**. Reuse the pattern; do not reinvent it.

Composition root: `apps/web/services/voice-service.ts`, ~10 lines, same shape as
`domains-service.ts`.

## 7.2 Routes

| Route | Methods | Auth |
|---|---|---|
| `/api/agents/[id]/voice` | `GET`, `PATCH` | Session + ownership |
| `/api/voice/preview` | `POST` | Session + ownership (body: `agentId`, `sampleText`) |
| `/api/voice/library` | `GET` | Session (query: `language`, `context`) |
| `/api/voice/custom` | `POST` | Session + ownership (Phase 3b) |

**Fold `voiceSettings` into the existing `PATCH /api/agents/[id]`** rather than a
separate resource — it is a field on the agent, exactly like `tools` and
`filterQuestions`. Add it to `createAgentSchema` / `updateAgentSchema` in
`services/api/src/agents/schemas.ts` and re-export from
`services/api/src/voice/schemas.ts` so the schema stays owned by one module.
Keep a dedicated `GET /api/agents/[id]/voice` only if a read-only preview needs
a lighter payload.

## 7.3 Widget capability advertisement

`handleChatConfig` (`GET /api/chat`, no conversationId) currently returns
domain + agent name/description. Add:

```ts
voice: {
  enabled: boolean;
  stt: boolean;
  mode: "off" | "read_aloud" | "auto";
  language: string;
}
```

The widget uses `stt` to decide whether to render the mic at all, and `mode` to
decide whether replies auto-speak. **No secret or provider detail may appear
here** — the response is public to anyone holding the embed secret.

## 7.4 Dashboard UI

On the agent settings page (`apps/web/components/dashboard/agent-actions.tsx`
already hosts tools + filter questions), add a **Voice** section:

- Enable voice (switch)
- Mode segmented control: Off · Read aloud · Auto
- Voice picker: curated prebuilt voices grouped by language, with each voice's
  character; "Browse library" for the full set
- Language select: `en`, `ak` (Akan/Twi), `ha-NG` (Hausa), `ig` (Igbo),
  `yo` (Yoruba), `fr`, `es`, `pt`, `ar`, … + Auto-detect
- Style textarea → `speech_metadata.style`
  (placeholder: *"warm, friendly, professional; speak slowly"*)
- Accept speech input (switch) + transcription language + vocabulary textarea
  (one term per line) with a **"Suggest from catalog"** button that pre-fills
  active product names + domain name + agent name
- **Preview button** → `POST /api/voice/preview` → plays the sample inline

Respect `businessType` (`services/api/src/domains/business-types.ts` is the
established config-driven extension point): a clinic should default to a calm,
professional style; a restaurant to a warm, energetic one. Add an optional
`voiceHints: { style, voiceId, language }` to `BusinessTypeConfig` — **that
alone is a full industry adaptation with no other file changes**, the same
extensibility contract Phase 9 of `business_type_plan.md` promised.

## 7.5 Custom brand voice (3b) — the differentiator

`POST /v1beta/voices` with `type: "prompted"` and a natural-language
description turns an owner's words into a persistent `voice_...` persona.

> "A calm, reassuring woman's voice with a slight Ghanaian accent. She speaks
> slowly and clearly, like a nurse explaining a result."

Stored on the agent as `voiceId: "voice_..."`. **This is the single most
sellable feature in the plan** — "give your agent your staff member's voice" is
not something a support bot competitor can say.

Guardrails:

- **200 voices per project** (Gemini quota), **1-year TTL** reset by use.
  Enforce a much lower cap in-product: 3 custom voices per agent, 10 per owner,
  via a `PlanLimits` field.
- **Never persist the Gemini key to the browser** — the creation call is
  server-side, owner-scoped.
- Custom voice creation **costs money** and mints a persistent resource.
  Gate it behind `pro`+.
- Editing/deleting a custom voice must be possible, or owners will burn their
  quota on mistakes.

---

# 8 Phase 4 — Hands-free conversation mode

The feature that makes voice genuinely different rather than a novelty.

- A toggle in the widget header: **Voice conversation**.
- When on: mic auto-restarts after each spoken reply finishes playing.
- **Silence detection**: a 1.2–1.5 s gap with no speech finalizes the turn
  (same heuristic the browser `SpeechRecognition` API uses). Needs the
  `AnalyserNode` RMS threshold from §5.3 — compute it on the main thread, no new
  endpoint.
- Hard turn cap (e.g. 20 consecutive voice turns) to prevent a stuck mic from
  looping forever and burning quota.
- The mic must never restart while an **owner** (human) has taken over —
  listen to the delta stream and drop out on any `sender: "owner"` message.
- Show a persistent, obvious listening indicator. A widget that silently
  activates the microphone is alarming and, on iOS, will simply fail the
  permission prompt.

---

# 9 Phase 5 — Live API (deferred, infra-gated)

Only after Option B is proven in production, and only with a websocket host.

Migration path is clean: the `speech` / `audio` SSE events in §6.4 are a
superset of what a Live API session emits, so the widget's audio queue does not
change — only the transport behind `/api/chat` does. The pieces that would be
replaced are `segmenter` + `synthesizeSpeech`; `speakableText` (the markdown
sanitizer) stays, because a live model will still emit markdown.

Prerequisite work, none of which exists today:

- A websocket-capable host (Cloudflare Durable Object is the cheapest; Vercel
  Fluid Compute is the least new mental load)
- Ephemeral token minting so the key never reaches the browser
- Per-domain rate limiting at the edge
- Reworking `tool-executor.ts` for live tool-call semantics
- A decision on how the **human handoff** works when the agent is mid-utterance

**Do not start this phase before Phase 4 is shipped and measured.**

---

# 10 Cost control

Every character spoken and every second transcribed is billable. Without
discipline this is the most expensive thing on the platform.

1. **Plan gating** — `voiceTurnsPerMonth`, `speechCharactersPerMonth`,
   `transcriptionsPerMonth` (§3.3). Checked **before** calling Gemini, not
   after.
2. **Never synthesize what will not be heard.** `speakableText` output that is
   empty or under `minChars` is skipped entirely — no API call.
3. **Truncate absurd turns.** Cap synthesis at 4 000 characters per reply;
   beyond that, send text only. A runaway tool loop should not become a
   runaway audio bill.
4. **`mode: "off"` on free.** Zero cost by default.
5. **Flash-Lite by default.** `gemini-3.8-flash-lite-tts` is explicitly
   recommended for high-volume conversational cascades. Reserve
   `gemini-3.8-flash-tts` for owners who pick a brand voice and pay for it.
6. **Meter and display.** Extend the P11 usage service with
   `getMonthlyVoiceUsage`; add cards to `/dashboard/usage`. Owners who cannot
   see consumption will not trust the limit.
7. **Record actuals.** `messages.metadata` gets
   `{ voice: true, speechChars, sttSeconds }`. This is the data that turns the
   Phase 6 format decision and the Phase 5 go/no-go into informed calls rather
   than guesses.

---

# 11 Accessibility

PRODUCT.md commits: the widget *"runs inside third-party pages and must not
break their layout or keyboard/screen-reader flow."* Voice must not become an
unreachable, unusable-by-default mode.

- Mic button: real `<button type="button">` with `aria-label` and
  `aria-pressed` reflecting recording state. In tab order after the input.
- Space/Enter activates the focused mic. **Never** a global key listener —
  hijacking Space breaks the host page.
- `aria-live="polite"` region announces "Recording…", "Transcribing…",
  transcript results, and "Agent is speaking". Errors use `role="alert"`.
- Speaker replay buttons are real buttons with labels; the visible waveform is
  decorative (`aria-hidden`).
- A transcript of the spoken reply is already on screen — voice output must
  **never** be the only way to get the information. This is already true by
  construction; state it as an invariant so nobody "optimizes" it away.
- Respect `prefers-reduced-motion` for the waveform animation. Replace the
  animated bars with a static recording dot.
- Every voice failure degrades to the text path silently and non-destructively.
  Never block text chat on audio.

---

# 12 Security

The roadmap's non-negotiables apply in full.

| Rule | Application |
|---|---|
| No secrets in `NEXT_PUBLIC_*` | All Gemini calls are server-side. The widget never sees a key. |
| Secret-gated public endpoints | `/api/voice/transcribe` requires `x-embed-secret`, same as `/api/chat` |
| Zod at every boundary | `transcribeSchema` (mime allowlist, byte cap), `voiceSettingsSchema`, `previewSchema` |
| Ownership before every mutation | `requireOwnedAgent` on all `/api/agents/[id]/voice` and `/api/voice/preview` writes |
| Rate limits | Separate `stt:${visitorId}` limiter + plan caps |
| No module-level mutable state | Segmenter lives in the stream closure. `PREBUILT_VOICES` and the voice-library cache are immutable constants / injected deps |

**Input handling specifics:**

- **Mime allowlist, not blocklist.** Accept only `audio/webm`, `audio/mp4`,
  `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/aac`, `audio/m4a`,
  `audio/flac`. Reject anything else with 400. The client-declared MIME type
  is attacker-controlled and is **not** a security boundary.
- **Validate magic bytes**, not just the declared MIME. Check the container
  signature before handing bytes to Gemini.
- **Hard byte cap** (`VOICE_MAX_TRANSCRIPT_BYTES`) enforced by reading the
  multipart in a streaming fashion and aborting past the cap — never
  `await request.formData()` on an unbounded body.
- **Never echo the transcript into a log line.** Voice is the most
  privacy-sensitive data the platform will ever handle. Log the byte count and
  duration; not the text.
- **CORS on `/api/voice/transcribe`** via the existing `CORS_HEADERS`. And
  restrict `Access-Control-Allow-Methods`/`Headers` to what is actually needed
  rather than blanket-allowing everything.
- **Custom vocabulary is owner text** — sanitize to `[A-Za-z0-9 '-]`, cap at
  100 entries × 60 chars, so it cannot be used to smuggle prompt material.

---

# 13 Migration journal caveat

This repo's Drizzle journal is already inconsistent — `_journal.json`
references a missing `0021_nifty_masque.sql`, and `0022_include_orders.sql` /
`0023_payments_external_key.sql` exist on disk but are not journaled.
Snapshots are missing for 0005–0013.

**Plan for `drizzle-kit generate` to fail or produce drift.** Follow the
established practice in this repo: hand-write
`packages/database/drizzle/0027_agents_voice_settings.sql`, apply it to Neon
directly, and update the schema file to match.

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_settings jsonb;
```

Add `voiceSettings` to the `agents` table object in
`packages/database/src/schema/index.ts`:

```ts
voiceSettings: jsonb("voice_settings").$type<VoiceSettings>(),
```

Do **not** import the `VoiceSettings` type into the schema file from
`@repo/api` — that would invert the dependency. Define the shape in
`packages/database/src/schema/index.ts` (or a shared types module) and let
`@repo/api/voice/schemas.ts` zod-validate against it. `agents.filterQuestions`
is already `jsonb` with no type annotation; follow that precedent if the
import direction proves awkward.

---

# 14 Phased rollout

Each phase ends verified: `check-types` + `lint` green, feature exercised
against the running dev server.

| Phase | Scope | Ship condition |
|---|---|---|
| **P0** | `services/ai/src/voice.ts`, env, plan limits, migration | `synthesizeSpeech` returns PCM over curl; `transcribeAudio` returns text; `VOICE_ENABLED=false` disables |
| **P1** | `/api/voice/transcribe` + widget mic + auto-send | Visitor records in Chrome, Safari **and** Firefox; transcript lands in the input; 5 languages verified |
| **P2** | `speech-segment.ts` + `speakableText` + SSE `speech`/`audio` events + widget AudioContext queue | Text chat byte-identical when voice off; audio arrives ~500 ms after first sentence; **no markdown, URLs, or citation markers audible** |
| **P3** | `services/api/src/voice` service, routes, dashboard UI, `businessType` voice hints | Owner configures voice, previews it, widget honours it after reload |
| **P3b** | Custom brand voice (`voice_...`) | Owner describes a voice, hears it, uses it in the widget |
| **P4** | Hands-free conversation mode + silence detection | 20 consecutive voice turns with no duplicate sends and no stuck mic |
| **P5** | Live API | **Blocked** on websocket infra decision |
| **P6** | `audio/mulaw` bandwidth mode, usage metering polish | 3G test on a throttled connection confirms sub-100 KB/s audio |

**Hard rule for P2:** the `type: "text"` stream must be unchanged for existing
widgets. Voice is additive. If P2 requires touching text rendering, it is
wrong.

---

# 15 Verification

Typecheck + lint on `@repo/ai`, `@repo/api`, `@repo/database`, `web`:

```
pnpm --filter @repo/ai      check-types && pnpm --filter @repo/ai      lint
pnpm --filter @repo/api     check-types && pnpm --filter @repo/api     lint
pnpm --filter @repo/database check-types && pnpm --filter @repo/database lint
pnpm --filter web           check-types && pnpm --filter web           lint
```

**curl** (embed secret from a seeded domain):

```
# STT
curl -X POST localhost:3000/api/voice/transcribe \
  -H "x-embed-secret: $SECRET" -F "audio=@sample.webm;type=audio/webm"
# → { "text": "...", "language": "en" }   200
# → 401 no secret · 403 wrong secret · 400 bad mime · 413 oversize · 429 rate/plan

# SSE — confirm speech + audio frames interleave with text
curl -N -X POST localhost:3000/api/chat \
  -H "x-embed-secret: $SECRET" -H 'content-type: application/json' \
  -d '{"message":"What is on your menu?","visitorId":"test-visitor-001"}'
# → data: {"type":"voice",...}
# → data: {"type":"text","delta":"..."}
# → data: {"type":"speech","id":"...","text":"We have jollof rice and ..."}
# → data: {"type":"audio","id":"...","chunk":"<base64 PCM>"}
# → data: {"type":"done",...}
```

**Unit tests** (pure functions, no I/O):

- `speakableText` — markdown links, bold, code fences, `[1]` citations, URLs,
  emoji, tables, currency preserved
- `isSentenceBoundary` — `GH₵750.00`, `1.5`, `e.g.`, `Mr.`, `...`, newline
- `createSegmenter` — min/max flush, tail flush, reset-on-error drops partial

**Headless Chrome with the real widget:**

- Record → transcribe → auto-send → SSE → audio frames
- **Assert audio frame arrival and total decoded byte count, not actual sound.**
  Asserting audible output in headless Chrome is unreliable and will produce
  false failures.
- Verify `aria-pressed` toggles and the live region updates
- Verify barge-in: start recording mid-playback, assert playback stops
- Verify **no host-page CSS leakage** — voice controls must render correctly on
  a page with aggressive global CSS
- Verify a **CSP-restricted host page** (`script-src 'self'`) still works

**Regression, non-negotiable:**

- Voice disabled → text chat byte-identical to pre-P2
- `VOICE_ENABLED=false` → no voice events, no `/api/voice/*` routes respond
- Gemini TTS returns 429 → text reply still completes and `done` still fires

**Clean up fixtures from Neon after every live run**, consistent with existing
E2E practice in this repo.

---

# 16 File checklist

## New files

```
packages/database/drizzle/0027_agents_voice_settings.sql
services/ai/src/voice.ts
services/ai/src/voice.test.ts
services/api/src/voice/index.ts
services/api/src/voice/schemas.ts
services/api/src/voice/server.ts
services/api/src/chat/speech-segment.ts
services/api/src/chat/speech-segment.test.ts
apps/web/services/voice-service.ts
apps/web/app/api/voice/transcribe/route.ts
apps/web/app/api/voice/preview/route.ts
apps/web/app/api/voice/library/route.ts
apps/web/app/api/voice/custom/route.ts
apps/web/components/dashboard/voice-settings-form.tsx
```

## Modified files

```
turbo.json                                     + 5 voice env vars in globalEnv
apps/web/.env                                  + voice env vars
packages/database/src/schema/index.ts          + voiceSettings jsonb
packages/database/src/schema/index.ts          + VoiceSettings type
services/api/package.json                      + "./voice" exports
services/api/src/index.ts                      + voice barrel
services/api/src/plans/server.ts               + 4 voice limits + 2 asserts
services/api/src/plans/schemas.ts              + voice limit fields
services/api/src/domains/business-types.ts     + voiceHints per type
services/api/src/agents/schemas.ts             + voiceSettings on create/update
services/api/src/agents/server.ts               + persist voiceSettings
services/api/src/chat/schemas.ts               + transcribe/preview schemas
services/api/src/chat/server.ts                + segmenter + speech synthesis in handleChatPost
services/api/src/chat/server.ts                + voice block in handleChatConfig
services/ai/src/index.ts                       + voice exports
apps/web/services/chat-service.ts              + synthesize/transcribe wiring
apps/web/lib/rate-limit.ts                     + voiceRateLimiter
apps/web/components/widget/zy-widget.tsx       + voice prop passthrough
apps/web/components/dashboard/agent-actions.tsx+ voice section
apps/web/components/domains/embed-snippet.tsx + data-autosend attribute
apps/web/components/dashboard/app-sidebar.tsx  + nothing (voice is a setting, not a page)
apps/web/public/widget.js                      + mic, recorder, AudioContext queue
apps/web/content/docs/widget.mdx               + voice attributes + browser support
apps/web/content/docs/agents.mdx               + voice configuration guide
apps/web/pricing → app/pricing/page.tsx        + voice limits in plan table
```

---

# 17 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Audio bandwidth** — 48 KB/s + 33 % base64 on a 3G connection | High | Ship `audio/l16` first, measure, then `audio/mulaw` @ 8 kHz in P6. Keep replies short in voice mode |
| **TTS latency kills the illusion** | Medium | Sentence-boundary streaming (not end-of-turn). Never synthesize on `done` |
| **Markdown read aloud** — instant credibility loss | High | `speakableText` with table-driven tests. Non-negotiable, P2 gate |
| **Autoplay blocked** — silent failure, looks broken | Medium | Lazy `AudioContext` on first gesture; `_audioUnlocked` flag; degrade to `read_aloud` |
| **CSP on customer sites blocks blob/data workers** | Medium | Main-thread `AudioBufferSourceNode`, no workers, no `blob:` URLs |
| **Cost blowout** | High | Plan gating before the API call, truncation cap, Flash-Lite default, usage metering |
| **TTS/STT models are preview and can change** | Medium | Env-var model names, no hard-coded IDs, response shape validated before use |
| **Safari produces `audio/mp4`** | Medium | MIME probe order + server-side mapping to `audio/m4a` |
| **Voice reads over a human after escalation** | Medium | Cancel pending speech on the `escalate` event |
| **Mic permission denied reads as a broken product** | Low | Explain and degrade; never hide the control |
| **Visitor loops the mic overnight** | Low | Per-turn cap in hands-free mode + plan limits |
| **`_sendBtn` selector breakage** when adding the mic button | Certain, if missed | Class-based selectors. See §5.3 |

---

# 18 Open questions for the owner

1. **English-first or local-language-first?** The AI text model is
   English. If a visitor speaks Akan, `gemini-3.5-transcribe` with auto-detect
   will transcribe it, but the **reply will be in English**. Do we add a
   "reply in the visitor's language" system-prompt instruction? It degrades
   answer quality and inflates TTS cost. **Recommend: yes, gated behind an
   explicit owner toggle, not automatic.**
2. **Record and store transcripts?** Analytics on voice-drop-off would be
   valuable. Privacy says no. **Recommend: aggregate metrics only
   (turn count, duration, completion) — never transcript content.**
3. **Voice on the free plan at all?** **Recommend no** — the cost math does not
   work at zero revenue.
4. **Custom brand voices: metered or included on pro+?** Each minted voice
   costs money and consumes one of 200 project slots. **Recommend 3 included on
   Business, purchasable on Enterprise.**
5. **Should escalated human replies be synthesized too?** Today the owner
   types and the visitor reads. Speaking the owner's message closes the loop on
   "human handoff is a feature". **Recommend yes, using a separate neutral
   voice so the owner is not impersonated by the agent's brand voice.**