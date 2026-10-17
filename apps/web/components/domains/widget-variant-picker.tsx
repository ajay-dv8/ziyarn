"use client";

import { useState } from "react";

import { WIDGET_VARIANTS, type WidgetVariantId } from "@repo/api/domains";
import { updateDomainAction, type ActionResult } from "@/lib/actions/domains";

/**
 * Per-domain widget selection.
 *
 * Reads the list from the shared registry — adding a widget is one row there,
 * never a hard-coded option in this component.
 */
export function WidgetVariantPicker({
  domainId,
  currentVariant,
}: {
  domainId: string;
  currentVariant: WidgetVariantId;
}) {
  const [selected, setSelected] = useState<WidgetVariantId>(currentVariant);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = selected !== currentVariant;

  async function save() {
    setPending(true);
    setError(null);
    setFeedback(null);

    const result = (await updateDomainAction(domainId, {
      widgetVariant: selected,
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
      <span className="text-sm font-medium">Widget</span>
      <div
        role="radiogroup"
        aria-label="Widget style"
        className="space-y-2"
      >
        {WIDGET_VARIANTS.map((variant) => {
          const isSelected = variant.id === selected;
          return (
            <label
              key={variant.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <input
                type="radio"
                name={`widget-variant-${domainId}`}
                value={variant.id}
                checked={isSelected}
                onChange={() => setSelected(variant.id)}
                className="mt-1"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  {variant.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {variant.description}
                </span>
              </span>
            </label>
          );
        })}
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
          {pending ? "Saving…" : "Save widget"}
        </button>
        {feedback ? (
          <span className="text-xs text-green-600">{feedback}</span>
        ) : null}
        {!dirty && !pending ? (
          <span className="text-xs text-muted-foreground">
            This is the widget visitors currently see.
          </span>
        ) : null}
      </div>
    </div>
  );
}