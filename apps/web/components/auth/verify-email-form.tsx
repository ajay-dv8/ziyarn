"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";

import { authClientService } from "./auth-client";
import { APP_ROUTES } from "@/constants/routes";

export function VerifyEmailForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onVerify = async () => {
    setPending(true);
    setFormError(null);

    const { error } = await authClientService.verifyEmail(token);
    if (error) {
      setFormError(error.message);
      setPending(false);
      return;
    }

    setVerified(true);
    setPending(false);
  };

  if (verified) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          Your email address is verified.
        </div>
        <Button className="w-full" render={<Link href={APP_ROUTES.DASHBOARD} />}>
          Continue to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Confirm this address to finish setting up your account. This link can
        only be used once.
      </p>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button onClick={onVerify} disabled={pending} className="w-full">
        {pending ? "Verifying…" : "Verify email"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={APP_ROUTES.SIGN_IN} className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
