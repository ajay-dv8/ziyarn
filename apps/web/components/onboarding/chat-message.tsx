"use client";

import { cn } from "@repo/ui/lib/utils";
import { Bot, User } from "lucide-react";

export type ChatRole = "bot" | "user";

export function ChatMessage({
  role,
  children,
  subText,
}: {
  role: ChatRole;
  children: React.ReactNode;
  /** Muted helper lines rendered under the main bubble (bot messages only). */
  subText?: string[];
}) {
  const isBot = role === "bot";

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300",
        isBot ? "justify-start" : "justify-end",
      )}
    >
      {isBot ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </span>
      ) : null}

      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-1",
          isBot ? "items-start" : "items-end",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            isBot
              ? "rounded-tl-md bg-muted text-foreground"
              : "rounded-tr-md bg-primary text-primary-foreground",
          )}
        >
          {children}
        </div>
        {subText && subText.length > 0 ? (
          <div className="space-y-0.5 px-1">
            {subText.map((line, index) => (
              <p key={index} className="text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {!isBot ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}

/** Three bouncing dots shown while the bot "types". */
export function ChatTyping() {
  return (
    <div className="flex w-full items-start gap-2.5 animate-in fade-in duration-200">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-3.5 py-3">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
