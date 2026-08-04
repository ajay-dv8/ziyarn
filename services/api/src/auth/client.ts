import type { createAuthClient } from "better-auth/react";
import type { z } from "zod";

import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@repo/api/auth/schemas";

export type AuthClient = ReturnType<typeof createAuthClient>;

export type AuthFormError = {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function toAuthFormError(issues: z.ZodError): AuthFormError {
  return {
    status: 422,
    message: "Please fix the highlighted fields.",
    fieldErrors: issues.flatten().fieldErrors,
  };
}

function toClientError(error: { status?: number; message?: string }): AuthFormError {
  return { status: error.status ?? 500, message: error.message ?? "Something went wrong." };
}

/**
 * Client-side auth service. Wraps the Better Auth client so UI code
 * only ever talks to validated, typed methods that return normalized
 * `{ data, error }` results.
 */
export function createAuthClientService(client: AuthClient) {
  return {
    signUp: async (input: SignUpInput) => {
      const parsed = signUpSchema.safeParse(input);
      if (!parsed.success) {
        return { data: null, error: toAuthFormError(parsed.error) };
      }
      const result = await client.signUp.email(parsed.data);
      return {
        data: result.data,
        error: result.error ? toClientError(result.error) : null,
      };
    },

    signIn: async (input: SignInInput) => {
      const parsed = signInSchema.safeParse(input);
      if (!parsed.success) {
        return { data: null, error: toAuthFormError(parsed.error) };
      }
      const result = await client.signIn.email(parsed.data);
      return {
        data: result.data,
        error: result.error ? toClientError(result.error) : null,
      };
    },

    signOut: async () => {
      const result = await client.signOut();
      return {
        data: result.data,
        error: result.error ? toClientError(result.error) : null,
      };
    },

    signInWithGoogle: (callbackURL = "/") =>
      client.signIn.social({ provider: "google", callbackURL }),

    signInWithLinkedIn: (callbackURL = "/") =>
      client.signIn.social({ provider: "linkedin", callbackURL }),

    useSession: client.useSession,
  };
}

export type AuthClientService = ReturnType<typeof createAuthClientService>;
