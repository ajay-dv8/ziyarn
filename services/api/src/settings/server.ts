import { eq } from "drizzle-orm";

import type { Auth } from "better-auth";

import type { Database } from "@repo/database";
import { userSettings } from "@repo/database/schema";

import {
  changePasswordSchema,
  updateDefaultCurrencySchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateDefaultCurrencyInput,
  type UpdateProfileInput,
} from "@repo/api/settings/schemas";

export class SettingsServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SettingsServiceError";
  }
}

const unauthorized = () =>
  new SettingsServiceError(401, "UNAUTHORIZED", "You must be signed in");

export function createSettingsService(deps: {
  db: Database;
  getSession: (
    headers: Headers,
  ) => Promise<{ user: { id: string; name: string; email: string } } | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  auth: Auth<any>;
}) {
  const { db, getSession, auth } = deps;

  const requireSession = async (headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    return session;
  };

  const upsertSettings = async (ownerId: string) => {
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.ownerId, ownerId))
      .limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(userSettings)
      .values({ ownerId })
      .returning();
    return created!;
  };

  return {
    async getSettings(headers: Headers) {
      const session = await requireSession(headers);
      const settings = await upsertSettings(session.user.id);
      return {
        user: { name: session.user.name, email: session.user.email },
        defaultCurrency: settings.defaultCurrency,
      };
    },

    async updateProfile(input: UpdateProfileInput, headers: Headers) {
      const body = updateProfileSchema.parse(input);
      await requireSession(headers);
      await auth.api.updateUser({
        body: { name: body.name },
        headers,
      });
    },

    async updateDefaultCurrency(
      input: UpdateDefaultCurrencyInput,
      headers: Headers,
    ) {
      const body = updateDefaultCurrencySchema.parse(input);
      const session = await requireSession(headers);
      const [existing] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.ownerId, session.user.id))
        .limit(1);
      if (existing) {
        await db
          .update(userSettings)
          .set({
            defaultCurrency: body.defaultCurrency,
            updatedAt: new Date(),
          })
          .where(eq(userSettings.ownerId, session.user.id));
      } else {
        await db.insert(userSettings).values({
          ownerId: session.user.id,
          defaultCurrency: body.defaultCurrency,
        });
      }
    },

    async changePassword(input: ChangePasswordInput, headers: Headers) {
      const body = changePasswordSchema.parse(input);
      await requireSession(headers);
      await auth.api.changePassword({
        body: {
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
        },
        headers,
      });
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
