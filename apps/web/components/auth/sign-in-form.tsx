"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { authClientService } from "./auth-client";

export function SignInForm({
  socialProviders,
}: {
  socialProviders: { google: boolean; linkedin: boolean };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const { error } = await authClientService.signIn({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (error) {
      setFieldErrors(error.fieldErrors ?? {});
      setFormError(error.message);
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-xs text-destructive">
            {fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
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

      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {(socialProviders.google || socialProviders.linkedin) && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or continue with
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-2">
            {socialProviders.google && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => authClientService.signInWithGoogle("/")}
              >
                Google
              </Button>
            )}
            {socialProviders.linkedin && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => authClientService.signInWithLinkedIn("/")}
              >
                LinkedIn
              </Button>
            )}
          </div>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
