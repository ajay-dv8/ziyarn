import { createAuthClient } from "better-auth/client";

/**
 * Point at the ADMIN app, never the customer app.
 *
 * Previously this read NEXT_PUBLIC_BETTER_AUTH_URL, which is the *customer*
 * app's URL (localhost:3000). Every admin sign-in attempt was therefore sent
 * to the customer auth server instead of the admin one.
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_ADMIN_BETTER_AUTH_URL ?? "http://localhost:3001",
});