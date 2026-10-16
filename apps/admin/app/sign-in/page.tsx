"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Reads the post-login destination from the query string.
 *
 * Deliberately NOT useSearchParams(): that hook opts a client component out of
 * static prerendering and throws at build time unless it sits under a
 * Suspense boundary. Reading window.location inside the submit handler avoids
 * the hook (and the fallback flash) entirely — the value is only needed once,
 * on the client, after a real user gesture.
 *
 * Only same-origin relative paths are accepted. `returnTo` arrives from the
 * URL, so without this guard ?returnTo=https://evil.example would make the
 * sign-in page an open redirect for whoever clicked the crafted link.
 */
function readReturnTo(): string {
  const fallback = "/admin";
  if (typeof window === "undefined") {
    return fallback;
  }
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  if (!candidate) {
    return fallback;
  }
  // Reject absolute URLs, protocol-relative "//host", and backslash tricks that
  // some browsers normalise to "//host".
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;
  return candidate;
}

export default function SignInPage(): React.ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    });

    if (authError) {
      setError(authError.message ?? "Invalid credentials");
      setPending(false);
      return;
    }

    // Only admins on the allowlist may proceed. requireAdmin() on /admin
    // re-checks, so a signed-in customer is bounced back here regardless of
    // what this client believes.
    router.push(readReturnTo());
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Admin Panel
          </h1>
          <p className="text-sm text-zinc-400">
            Sign in to access the admin dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="admin@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="••••••••"
            />
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
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
