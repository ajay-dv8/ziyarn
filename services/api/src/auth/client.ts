import type { createAuthClient } from "better-auth/react";
import type { z } from "zod";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@repo/api/auth/schemas";
import { APP_ROUTES } from "@repo/routes";

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

    /**
     * Requests a reset email without revealing whether the address exists.
     * Better Auth already returns the same response for unknown users; the
     * only error worth surfacing is the rate limiter.
     */
    requestPasswordReset: async (input: ForgotPasswordInput) => {
      const parsed = forgotPasswordSchema.safeParse(input);
      if (!parsed.success) {
        return { data: null, error: toAuthFormError(parsed.error) };
      }
      const result = await client.requestPasswordReset({
        email: parsed.data.email,
      });
      if (result.error?.status === 429) {
        return {
          data: null,
          error: {
            status: 429,
            message: "Too many reset attempts. Please try again later.",
          },
        };
      }
      return { data: null, error: null };
    },

    resetPassword: async (input: ResetPasswordInput) => {
      const parsed = resetPasswordSchema.safeParse(input);
      if (!parsed.success) {
        return { data: null, error: toAuthFormError(parsed.error) };
      }
      const result = await client.resetPassword({
        newPassword: parsed.data.password,
        token: parsed.data.token,
      });
      if (result.error) {
        if (result.error.status === 400 || result.error.status === 401) {
          return {
            data: null,
            error: {
              status: result.error.status,
              message:
                "This reset link is invalid or has expired. Request a new one.",
            },
          };
        }
        return { data: null, error: toClientError(result.error) };
      }
      return { data: result.data, error: null };
    },

    sendVerificationEmail: async (email: string) => {
      const result = await client.sendVerificationEmail({
        email,
        callbackURL: APP_ROUTES.DASHBOARD,
      });
      return {
        data: result.data,
        error: result.error ? toClientError(result.error) : null,
      };
    },

    verifyEmail: async (token: string) => {
      const result = await client.verifyEmail({ query: { token } });
      if (result.error) {
        return {
          data: null,
          error: {
            status: result.error.status ?? 400,
            message:
              "This verification link is invalid or has expired. Sign in and request a new one.",
          },
        };
      }
      return { data: result.data, error: null };
    },

    signInWithGoogle: (callbackURL = "/") =>
      client.signIn.social({ provider: "google", callbackURL }),

    signInWithLinkedIn: (callbackURL = "/") =>
      client.signIn.social({ provider: "linkedin", callbackURL }),

    useSession: client.useSession,
  };
}

export type AuthClientService = ReturnType<typeof createAuthClientService>;
