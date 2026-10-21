"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_API_ROUTES, ADMIN_ROUTES } from "@/constants/routes";
import { PasswordInput } from "@/components/password-input";

const INPUT_CLASS =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

/**
 * Client half of /setup. The page itself is a server component that gates on
 * the empty `admins` table — no useSearchParams here, which would opt this
 * route out of prerendering and fail the build.
 */
export default function SetupForm(): React.ReactNode {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(ADMIN_API_ROUTES.setup, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, bootstrapSecret }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !body?.ok) {
        setError(body?.message ?? "Could not complete setup.");
        setPending(false);
        return;
      }

      // better-auth set the session cookie during signUpEmail, so this lands
      // straight on the panel with no second sign-in.
      router.push(ADMIN_ROUTES.HOME);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
          Your name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoComplete="name"
          className={INPUT_CLASS}
          placeholder="Ajay"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className={INPUT_CLASS}
          placeholder="you@ziyarn.com"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
          Password
        </label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          placeholder="At least 12 characters"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="bootstrapSecret"
          className="text-sm font-medium text-zinc-300"
        >
          Bootstrap secret
        </label>
        <PasswordInput
          id="bootstrapSecret"
          value={bootstrapSecret}
          onChange={(event) => setBootstrapSecret(event.target.value)}
          required
          autoComplete="off"
        />
        <p className="text-xs text-zinc-500">
          Paste <code className="text-zinc-400">ADMIN_BOOTSTRAP_SECRET</code> from
          your environment. Generate one with{" "}
          <code className="text-zinc-400">
            node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
          </code>
          .
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Creating owner…" : "Create owner account"}
      </button>
    </form>
  );
}