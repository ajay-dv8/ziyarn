"use client";

import { Button } from "@repo/ui/components/button";

export type ChatChoiceOption = {
  label: string;
  onSelect: () => void;
  variant?: "default" | "outline";
  disabled?: boolean;
};

/** Button row rendered in place of the text input for branching steps. */
export function ChatChoices({ options }: { options: ChatChoiceOption[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.label}
          type="button"
          size="sm"
          variant={option.variant ?? (option === options[0] ? "default" : "outline")}
          onClick={option.onSelect}
          disabled={option.disabled}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
