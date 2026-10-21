"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";

import { authClientService } from "./auth-client";
import { APP_ROUTES } from "@/constants/routes";

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");

    setFieldErrors({});
    setFormError(null);

    if (password !== confirmation) {
      setFieldErrors({ confirmPassword: ["Passwords do not match."] });
      return;
    }

    setPending(true);
    const { error } = await authClientService.resetPassword({ token, password });

    if (error) {
      setFieldErrors(error.fieldErrors ?? {});
      setFormError(error.message);
      setPending(false);
      return;
    }

    setComplete(true);
    setPending(false);
  };

  if (complete) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          Your password has been updated. Sign in with the new password.
        </div>
        <Button className="w-full" render={<Link href={APP_ROUTES.SIGN_IN} />}>
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        {fieldErrors.password ? (
          <p id="password-error" className="text-xs text-destructive">
            {fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          placeholder="Repeat your new password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(fieldErrors.confirmPassword)}
          aria-describedby={
            fieldErrors.confirmPassword ? "confirm-password-error" : undefined
          }
        />
        {fieldErrors.confirmPassword ? (
          <p id="confirm-password-error" className="text-xs text-destructive">
            {fieldErrors.confirmPassword[0]}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Updating…" : "Update password"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Link expired?{" "}
        <Link
          href={APP_ROUTES.FORGOT_PASSWORD}
          className="font-medium text-primary hover:underline"
        >
          Request a new one
        </Link>
      </p>
    </form>
  );
}
