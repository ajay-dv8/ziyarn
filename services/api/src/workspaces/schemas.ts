import { z } from "zod";

import { assignableWorkspaceRoleSchema } from "@repo/api/workspaces/roles";

export {
  ASSIGNABLE_WORKSPACE_ROLES,
  WORKSPACE_ROLE_DESCRIPTIONS,
  WORKSPACE_ROLE_LABELS,
  assignableWorkspaceRoleSchema,
  workspaceRoleSchema,
} from "@repo/api/workspaces/roles";
export type {
  AssignableWorkspaceRole,
  WorkspaceRole,
} from "@repo/api/workspaces/roles";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "Workspace name is required")
  .max(100, "Workspace name must be at most 100 characters");

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export const renameWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: assignableWorkspaceRoleSchema.default("member"),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid("Invalid member id"),
  role: assignableWorkspaceRoleSchema,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type RenameWorkspaceInput = z.infer<typeof renameWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const teamNameSchema = z
  .string()
  .trim()
  .min(1, "Team name is required")
  .max(100, "Team name must be at most 100 characters");

export const createTeamSchema = z.object({
  name: teamNameSchema,
  workspaceId: z.string().uuid("Invalid workspace id"),
});

export const renameTeamSchema = z.object({
  name: teamNameSchema,
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: assignableWorkspaceRoleSchema.default("member"),
});

export const updateTeamMemberRoleSchema = z.object({
  memberId: z.string().uuid("Invalid member id"),
  role: assignableWorkspaceRoleSchema,
});

export const acceptTeamInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type RenameTeamInput = z.infer<typeof renameTeamSchema>;
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;
export type UpdateTeamMemberRoleInput = z.infer<
  typeof updateTeamMemberRoleSchema
>;
export type AcceptTeamInviteInput = z.infer<typeof acceptTeamInviteSchema>;
