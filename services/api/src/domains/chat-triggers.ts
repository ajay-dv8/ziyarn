import { z } from "zod";

/**
 * Chat trigger registry — the single source of truth for how a widget's chat
 * trigger (launcher) is picked and customized.
 *
 * Mirrors the widget-variants pattern: one list, read by the domain schema, the
 * dashboard picker and the public config endpoint. The domains table stores the
 * id as plain text and never declares it as an enum, so shipping a new trigger
 * never needs a migration, and the widget falls back to the default for
 * unknown values. Never declare a trigger name in feature code.
 *
 * `"default"` is an id of its own: it keeps the launcher each widget variant
 * ships today, so a domain that has not chosen a trigger renders exactly what
 * it rendered before this registry existed.
 */
export const CHAT_TRIGGERS = [
  {
    id: "default",
    label: "Match my widget",
    description: "The launcher built into your widget style",
    fields: [],
  },
  {
    id: "bubble",
    label: "Icon bubble",
    description: "A plain circle button with the chat icon or your logo",
    fields: ["iconSource"],
  },
  {
    id: "orb",
    label: "Glass orb",
    description: "The animated Strands orb from Modern Sleek, on any widget",
    fields: [],
  },
  {
    id: "pill",
    label: "Labeled pill",
    description: "A rounded button with your own text next to the chat icon",
    fields: ["label"],
  },
] as const;

export type ChatTriggerId = (typeof CHAT_TRIGGERS)[number]["id"];

export const DEFAULT_CHAT_TRIGGER: ChatTriggerId = "default";

export const CHAT_TRIGGER_IDS = CHAT_TRIGGERS.map((trigger) => trigger.id);

export function isChatTrigger(value: unknown): value is ChatTriggerId {
  return CHAT_TRIGGER_IDS.includes(value as ChatTriggerId);
}

/**
 * Normalises anything into a valid trigger id.
 *
 * Fail open: an unknown name, an empty string, or null all resolve to the
 * default. A row holding a retired id must never leave a customer's website
 * with a missing launcher.
 */
export function resolveChatTrigger(value: unknown): ChatTriggerId {
  if (typeof value !== "string") return DEFAULT_CHAT_TRIGGER;
  const normalized = value.trim();
  return isChatTrigger(normalized) ? normalized : DEFAULT_CHAT_TRIGGER;
}

export function chatTriggerLabel(value: unknown): string {
  const id = resolveChatTrigger(value);
  return CHAT_TRIGGERS.find((trigger) => trigger.id === id)?.label ?? id;
}

/**
 * Per-trigger customization. One JSONB bag so "customize" can grow without
 * migrations; every field is optional with a runtime default, and unknown keys
 * are refused at the API boundary (yet tolerated with defaults at read time —
 * a hand-edited row must not poison the config endpoint).
 */
export type TooltipVisibility = "never" | "hover" | "always";

export const chatTriggerConfigSchema = z
  .object({
    /** Pill trigger: the button text. */
    label: z.string().trim().min(1).max(32).optional(),
    /** Bubble trigger: what sits inside the circle. */
    iconSource: z.enum(["chat-icon", "logo"]).optional(),
    /** Tooltip text the launcher shows (widget renders it with textContent). */
    tooltip: z.string().trim().min(1).max(32).optional(),
    /** When the tooltip shows. `never` keeps existing installs unchanged. */
    tooltipVisibility: z.enum(["never", "hover", "always"]).optional(),
  })
  .strict();

export type ChatTriggerConfig = z.infer<typeof chatTriggerConfigSchema>;

/** Widget tooltip copy when the owner never wrote one. */
export const CHAT_TRIGGER_TOOLTIP_DEFAULT = "Chat with us";

/** Pill button copy when the owner never wrote one. */
export const CHAT_TRIGGER_LABEL_DEFAULT = "Chat with us";

/** Tooltip mode for widgets the owner has not configured (back-compat). */
export const TOOLTIP_VISIBILITY_DEFAULT: TooltipVisibility = "never";

/** The fully-resolved shape the public config endpoint serves — no misses. */
export type ResolvedChatTriggerConfig = {
  label: string;
  iconSource: "chat-icon" | "logo";
  tooltip: string;
  tooltipVisibility: TooltipVisibility;
};

/**
 * Fills the stored bag with the runtime defaults. Stored rows are jsonb and
 * outside zod's reach, so a miss (or a junk row) resolves to defaults rather
 * than breaking anyone's launcher.
 */
export function resolveChatTriggerConfig(
  config: unknown,
): ResolvedChatTriggerConfig {
  const parsed = chatTriggerConfigSchema.safeParse(config);
  const value = parsed.success ? parsed.data : {};
  return {
    label: value.label ?? CHAT_TRIGGER_LABEL_DEFAULT,
    iconSource: value.iconSource ?? "chat-icon",
    tooltip: value.tooltip ?? CHAT_TRIGGER_TOOLTIP_DEFAULT,
    tooltipVisibility: value.tooltipVisibility ?? TOOLTIP_VISIBILITY_DEFAULT,
  };
}
