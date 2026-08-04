import type { Auth } from "better-auth";

import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@repo/api/auth/schemas";

/**
 * Server-side auth service. Wrap the Better Auth instance so all
 * auth operations run through validated, typed boundaries.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic instance keeps full API typing
export function createAuthService<A extends Auth<any>>(auth: A) {
  return {
    /** Returns the current session (and user) or null. */
    getSession: async (headers: Headers) => auth.api.getSession({ headers }),

    /**
     * Registers a new user with email + password.
     * With `autoSignIn: false` this returns the created user without a session.
     */
    signUp: async (input: SignUpInput, headers?: Headers) => {
      const body = signUpSchema.parse(input);
      return auth.api.signUpEmail({ body, ...(headers ? { headers } : {}) });
    },

    /** Signs an existing user in. */
    signIn: async (input: SignInInput, headers?: Headers) => {
      const body = signInSchema.parse(input);
      return auth.api.signInEmail({ body, ...(headers ? { headers } : {}) });
    },

    /** Signs the current user out. */
    signOut: async (headers: Headers) => auth.api.signOut({ headers }),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
