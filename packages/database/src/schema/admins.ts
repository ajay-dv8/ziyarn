import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * Admin identity — the `user` model for the admin panel's better-auth instance.
 *
 * Kept entirely separate from the customer `user` table so a staff credential
 * can never be replayed against the customer app (and vice versa). See
 * plan/admin-roles-plan.md (R7) and drizzle/0027_admin_auth_tables.sql.
 */
export const admins = pgTable("admins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /**
   * @deprecated Legacy plaintext column, never read — better-auth stores the
   * scrypt hash in `admin_accounts.password`. Nullable since 0027 so it can be
   * dropped outright in a later migration. Do not write to this.
   */
  password: text("password"),
  role: text("role", { enum: ["superadmin", "admin", "viewer"] })
    .notNull()
    .default("admin"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Admin sessions — never shares the customer `session` table.
 *
 * NOTE on naming: the drizzle PROPERTY is `userId` while the Postgres COLUMN
 * stays `admin_id`. Better Auth's drizzle adapter resolves the session/account
 * → user relation by the conventional key `userId`, so naming the property
 * `adminId` fails at runtime with:
 *   The field "userId" does not exist in the schema for the model "account".
 * Keeping the column as `admin_id` makes the table self-documenting.
 */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("admin_sessions_admin_idx").on(table.userId)],
);

/** Admin credential accounts (password hash, or future OAuth providers). */
export const adminAccounts = pgTable(
  "admin_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("admin_accounts_admin_idx").on(table.userId)],
);

/** Admin email verification / password-reset tokens. */
export const adminVerifications = pgTable(
  "admin_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("admin_verifications_identifier_idx").on(table.identifier)],
);

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type AdminAccount = typeof adminAccounts.$inferSelect;