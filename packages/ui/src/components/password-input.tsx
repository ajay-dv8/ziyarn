"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@repo/ui/components/input"
import { cn } from "@repo/ui/lib/utils"

function PasswordInput({
  className,
  disabled,
  id,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-9", className)}
        disabled={disabled}
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
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
