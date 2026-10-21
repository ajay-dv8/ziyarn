"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";

import { authClientService } from "./auth-client";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const onResend = async () => {
    setPending(true);
    setMessage(null);
    setIsError(false);

    const { error } = await authClientService.sendVerificationEmail(email);
    if (error) {
      setIsError(true);
      setMessage(
        error.status === 429
          ? "Please wait a few minutes before requesting another email."
          : "Could not send the verification email. Please try again.",
      );
      setPending(false);
      return;
    }

    setMessage("Verification email sent. Check your inbox and spam folder.");
    setPending(false);
  };

  return (
    <div className="border-b bg-amber-50 px-4 py-2 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <p>Your email address is not verified yet.</p>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-current"
          onClick={onResend}
          disabled={pending}
        >
          {pending ? "Sending…" : "Resend verification email"}
        </Button>
        {message ? (
          <p role="status" className={isError ? "text-destructive" : undefined}>
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
