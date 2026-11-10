"use client";

import { useState } from "react";

import {
  CHAT_TRIGGERS,
  type ChatTriggerConfig,
  type ChatTriggerId,
  type ResolvedChatTriggerConfig,
  type TooltipVisibility,
} from "@repo/api/domains/chat-triggers";
import { Input } from "@repo/ui/components/input";
import { updateDomainAction, type ActionResult } from "@/lib/actions/domains";

const TOOLTIP_MODES: { value: TooltipVisibility; label: string }[] = [
  { value: "never", label: "Hidden" },
  { value: "hover", label: "On hover" },
  { value: "always", label: "Always visible" },
];

/** What the owner has typed so far — trimmed, sliced and shaped on save. */
type TriggerDraft = {
  tooltip: string;
  tooltipVisibility: TooltipVisibility;
  label: string;
  iconSource: "chat-icon" | "logo";
};

function draftToBag(
  draft: TriggerDraft,
  trigger: ChatTriggerId,
): ChatTriggerConfig {
  const bag: ChatTriggerConfig = {
    tooltipVisibility: draft.tooltipVisibility,
  };
  const tooltip = draft.tooltip.trim().slice(0, 32);
  if (tooltip) bag.tooltip = tooltip;
  const label = draft.label.trim().slice(0, 32);
  if (trigger === "pill" && label) bag.label = label;
  if (trigger === "bubble") bag.iconSource = draft.iconSource;
  return bag;
}

/** The chat trigger (launcher) per domain.
 *
 * Reads the options from the shared registry — adding a trigger is one row
 * there, never a hard-coded option in this component. Saving posts the whole
 * customization bag; the server validates the shape and every embedded widget
 * picks the change up on its next page load.
 */
export function ChatTriggerPicker({
  domainId,
  currentTrigger,
  currentConfig,
}: {
  domainId: string;
  currentTrigger: ChatTriggerId;
  currentConfig: ResolvedChatTriggerConfig;
}) {
  const [trigger, setTrigger] = useState<ChatTriggerId>(currentTrigger);
  const [draft, setDraft] = useState<TriggerDraft>({
    tooltip: currentConfig.tooltip,
    tooltipVisibility: currentConfig.tooltipVisibility,
    label: currentConfig.label,
    iconSource: currentConfig.iconSource,
  });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baselineDraft: TriggerDraft = {
    tooltip: currentConfig.tooltip,
    tooltipVisibility: currentConfig.tooltipVisibility,
    label: currentConfig.label,
    iconSource: currentConfig.iconSource,
  };
  const dirty =
    trigger !== currentTrigger ||
    JSON.stringify(draftToBag(draft, trigger)) !==
      JSON.stringify(draftToBag(baselineDraft, trigger));

  function updateDraft(patch: Partial<TriggerDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  function selectTrigger(id: ChatTriggerId) {
    setTrigger(id);
    // Picking any trigger turns the tooltip on — On hover is the sane first
    // choice. A user who explicitly chose Hidden never gets it re-enabled.
    if (draft.tooltipVisibility === "never") {
      updateDraft({ tooltipVisibility: "hover" });
    }
  }

  async function save() {
    setPending(true);
    setError(null);
    setFeedback(null);

    const result = (await updateDomainAction(domainId, {
      chatTrigger: trigger,
      chatTriggerConfig: draftToBag(draft, trigger),
    })) as ActionResult;

    setPending(false);
    if (result.ok) {
      setFeedback("Saved");
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Chat trigger</span>
      <div role="radiogroup" aria-label="Chat trigger" className="space-y-2">
        {CHAT_TRIGGERS.map((option) => {
          const isSelected = option.id === trigger;
          return (
            <label
              key={option.id}
              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                isSelected
                  ? "cursor-pointer border-primary bg-primary/5"
                  : "cursor-pointer hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name={`chat-trigger-${domainId}`}
                value={option.id}
                checked={isSelected}
                onChange={() => selectTrigger(option.id)}
                className="mt-1"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  {option.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Per-trigger customization fields */}
      {trigger === "pill" ? (
        <div className="space-y-1 pt-1">
          <label
            htmlFor={`chat-trigger-label-${domainId}`}
            className="text-sm font-medium"
          >
            Button text
          </label>
          <Input
            id={`chat-trigger-label-${domainId}`}
            type="text"
            maxLength={32}
            value={draft.label}
            onChange={(event) => updateDraft({ label: event.target.value })}
          />
        </div>
      ) : null}

      {trigger === "bubble" ? (
        <div className="space-y-1 pt-1">
          <span className="text-sm font-medium">Icon</span>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`chat-trigger-icon-${domainId}`}
                checked={draft.iconSource === "chat-icon"}
                onChange={() => updateDraft({ iconSource: "chat-icon" })}
              />
              Chat icon
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`chat-trigger-icon-${domainId}`}
                checked={draft.iconSource === "logo"}
                onChange={() => updateDraft({ iconSource: "logo" })}
              />
              Domain logo
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            The domain logo takes over once one is set above; until then the
            chat icon stays.
          </p>
        </div>
      ) : null}

      {/* Tooltip — offered for every trigger, the engine renders it for all. */}
      <div className="space-y-1 pt-2">
        <label
          htmlFor={`chat-trigger-tooltip-${domainId}`}
          className="text-sm font-medium"
        >
          Tooltip
        </label>
        <div className="flex gap-2">
          <Input
            id={`chat-trigger-tooltip-${domainId}`}
            type="text"
            maxLength={32}
            placeholder="Chat with us"
            value={draft.tooltip}
            onChange={(event) => updateDraft({ tooltip: event.target.value })}
          />
          <select
            aria-label="Tooltip visibility"
            value={draft.tooltipVisibility}
            onChange={(event) =>
              updateDraft({
                tooltipVisibility: event.target
                  .value as TriggerDraft["tooltipVisibility"],
              })
            }
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {TOOLTIP_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          Shown beside the launcher. Hidden keeps things exactly as they are —
          picking a trigger defaults the tooltip to On hover instead.
        </p>
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save trigger"}
        </button>
        {feedback ? (
          <span className="text-xs text-green-600">{feedback}</span>
        ) : null}
        {!dirty && !pending ? (
          <span className="text-xs text-muted-foreground">
            This is what visitors currently see.
          </span>
        ) : null}
      </div>
    </div>
  );
}
