"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Send } from "lucide-react";

export function ChatInput({
  onSubmit,
  placeholder,
  disabled = false,
  allowEmpty = false,
}: {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Enter with empty input still submits (for skippable steps). */
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  function submit() {
    const trimmed = value.trim();
    if ((!trimmed && !allowEmpty) || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        ref={inputRef}
        value={value}
        placeholder={placeholder ?? "Type your answer…"}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Your answer"
        autoComplete="off"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || (!value.trim() && !allowEmpty)}
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
