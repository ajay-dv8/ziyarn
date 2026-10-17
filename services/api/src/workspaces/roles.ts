import { z } from "zod";

/**
 * Role vocabulary, kept apart from the service so client components can import
 * it. `@repo/api/workspaces` re-exports the service, which reaches nodemailer
 * and the database — neither belongs in a browser bundle.
 */

/** Every role a workspace membership can hold. */
export const workspaceRoleSchema = z.enum([
  "owner",
  "admin",
  "member",
  "viewer",
]);

/**
 * Roles an owner or admin can assign. "owner" is not assignable: a workspace
 * has exactly one owner, created with the workspace.
 */
export const assignableWorkspaceRoleSchema = z.enum([
  "admin",
  "member",
  "viewer",
]);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type AssignableWorkspaceRole = z.infer<
  typeof assignableWorkspaceRoleSchema
>;

/** Roles an admin may assign when inviting or updating a member. */
export const ASSIGNABLE_WORKSPACE_ROLES: AssignableWorkspaceRole[] = [
  "admin",
  "member",
  "viewer",
];

/** How each role is named in the UI and in email. */
export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

/** One line each, so an owner can pick a role without guessing what it means. */
export const WORKSPACE_ROLE_DESCRIPTIONS: Record<
  AssignableWorkspaceRole,
  string
> = {
  admin: "Can invite people, change roles and manage everything in the team.",
  member: "Can manage agents, domains and knowledge bases.",
  viewer: "Read-only access to the team's agents and conversations.",
};
