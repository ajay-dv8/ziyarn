"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const INPUT_CLASS =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-10 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export function PasswordInput({
  className,
  disabled,
  id,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={className ? `${INPUT_CLASS} ${className}` : INPUT_CLASS}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-controls={id}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
