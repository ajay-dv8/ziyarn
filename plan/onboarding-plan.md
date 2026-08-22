# Conversational Onboarding Flow

## Overview

After sign-up (which keeps its normal form), users are redirected to a
conversational onboarding flow that guides them through setting up their
first domain, AI agent, and optionally a knowledge base — all via a
chat-like interface.

## What stays the same

- Sign-up form (`/sign-up`) — unchanged
- Sign-in form (`/sign-in`) — unchanged
- Better Auth config — unchanged
- All existing API routes — unchanged

## What changes

| File | Change |
|---|---|
| `packages/database/src/schema/domains.ts` | Add `logoUrl` text column |
| `services/api/src/domains/schemas.ts` | Add optional `logoUrl` to `createDomainSchema` |
| `services/api/src/domains/server.ts` | Pass `logoUrl` through on domain create |
| `lib/actions/domains.ts` | Pass `logoUrl` through server action |
| `components/auth/sign-up-form.tsx` | Redirect to `/onboarding` instead of `/dashboard` |
| `constants/routes/routes.ts` | Add `ONBOARDING` route constant |

## New files

| File | Purpose |
|---|---|
| `app/onboarding/page.tsx` | Server component — session check, renders onboarding |
| `components/onboarding/conversational-onboarding.tsx` | Step machine, messages, API calls |
| `components/onboarding/chat-message.tsx` | Bot/user bubble component |
| `components/onboarding/chat-input.tsx` | Text input + send button |
| `components/onboarding/chat-choice.tsx` | Button-based choice (upload/skip) |

## Conversational flow

```
Bot: "Welcome to Ziyarn! Let us get your first domain set up."

Bot: "What should we name your domain?"
     (bold + italic heading, sub-text: "Your domain name should
      identify your business — e.g. Acme Support")
User: "Acme Support"

Bot: "Give it a URL slug (or press Enter to skip)"
     sub-text: "This becomes your embed URL — e.g. acme-support"
User: "acme-support"   -> or empty to skip

Bot: "Do you have a business logo? Paste a URL or press Enter to skip"
User: "https://..."    -> or empty to skip

Bot: "Now let us set up your AI agent."
     "What should we call it?"
User: "Sales Assistant"

Bot: "What does your business do? (brief description)"
User: "We help small teams automate support"
     -> or empty to skip

Bot: "Want to add knowledge base docs now?"
     [Upload file]  [Skip for now]
User: picks one

Bot: "You are all set! Taking you to your dashboard..."
-> redirect to /dashboard
```

## Steps detail

| # | Bot message | Input type | Required | API call |
|---|---|---|---|---|
| 1 | "What should we name your domain?" | Text | Yes | — |
| 2 | "Give it a URL slug" | Text (optional) | No | — |
| 3 | "Business logo URL?" | Text (optional) | No | — |
| 4 | "What should we call your agent?" | Text | Yes | — |
| 5 | "What does your business do?" | Text (optional) | No | — |
| 6 | "Add knowledge docs?" | File upload or skip | No | POST /api/knowledge/upload |
| — | After step 5: create domain + agent | — | — | createDomainAction() + POST /api/agents |

## State machine

```
States: domainName -> domainSlug -> logoUrl ->
        agentName -> agentDescription ->
        knowledgeChoice -> knowledgeUpload ->
        allDone
```

- Each state: append bot message, wait for user input, validate, next state
- Error states: append error bot message, stay on same state for retry
- Domain + agent are created together after step 5 (before knowledge step)

## API calls (in order)

1. `createDomainAction({ name, slug, logoUrl })` — creates domain via server action
2. `POST /api/agents` — creates agent with name, description, linked to new domain
3. `POST /api/knowledge/upload` — (optional) uploads knowledge base document

## Schema changes

### domains table — add logoUrl

```ts
// packages/database/src/schema/domains.ts
// Add to domains table:
logoUrl: text("logo_url"),
```

```ts
// services/api/src/domains/schemas.ts
// Update createDomainSchema:
export const createDomainSchema = z.object({
  name: domainNameSchema,
  slug: domainSlugSchema,
  logoUrl: z.string().url().optional().nullable(),
});
```

## Component architecture

### ConversationalOnboarding (main orchestrator)

```ts
type Step =
  | "welcome"
  | "domainName"
  | "domainSlug"
  | "logoUrl"
  | "agentName"
  | "agentDescription"
  | "creating"
  | "knowledgeChoice"
  | "knowledgeUpload"
  | "allDone";

type Message = {
  id: string;
  role: "bot" | "user";
  content: string;
  subText?: string;
  bold?: boolean;
  italic?: boolean;
};

// State
messages: Message[]
currentStep: Step
pending: boolean
domainData: { name, slug, logoUrl }
agentData: { name, description }
domainId: string | null  // set after domain creation
```

### ChatMessage

```ts
props: {
  role: "bot" | "user";
  content: string;
  subText?: string;
  bold?: boolean;
  italic?: boolean;
}
```

- Bot: left-aligned, muted bg, "Z" icon avatar
- User: right-aligned, primary bg, white text, initials avatar
- Fade-in animation on mount

### ChatInput

```ts
props: {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: "text" | "password";
}
```

- Fixed at bottom of card
- Text input + send button
- Enter key submits
- Auto-focuses when enabled

### ChatChoice

```ts
props: {
  choices: { label: string; value: string; variant?: "default" | "outline" }[];
  onSelect: (value: string) => void;
  disabled?: boolean;
}
```

- Renders buttons instead of text input
- Used for the knowledge base upload/skip step

## Error handling

| Error | Bot response | Recovery |
|---|---|---|
| Domain slug taken | "That slug is already taken. Try another." | Stay on slug step |
| Agent creation fails | "Something went wrong setting up your agent." | Stay on agent name step |
| File upload fails | "Upload failed. Try again or skip." | Stay on knowledge step |
| Network error | "Network error. Please try again." | Stay on current step |
| Signup email taken | "An account with that email already exists." | Redirect to /sign-in |

## Visual design

- Centered card (same max-w-sm as sign-in)
- Chat messages fill the card body, auto-scroll to latest
- Input/choices bar fixed at bottom of card
- Bot avatar: small circle with "Z" icon, primary/10 bg
- User avatar: small circle with initials, primary bg
- Domain name question: bold italic bot message with smaller muted sub-text
- Messages fade in with subtle animation (tailwind animate-in)
- Typing indicator (3 bouncing dots) shown briefly before each bot message
- Overall height: min-h-svh centered, card grows with content

## Guard: skip onboarding if domain exists

The onboarding page server component should check:
1. If no session -> redirect to /sign-in
2. If user already has domains -> redirect to /dashboard
3. Otherwise -> render conversational onboarding
