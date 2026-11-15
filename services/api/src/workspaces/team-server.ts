import { randomUUID } from "node:crypto";

import { and, count, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  teams,
  teamMembers,
  teamInvites,
  workspaces,
  workspaceMembers,
} from "@repo/database/schema/workspaces";
import { user } from "@repo/database/schema/auth";

import { assertCanCreateTeam, getPlanLimits } from "@repo/api/plans";
import {
  createTeamSchema,
  inviteTeamMemberSchema,
  renameTeamSchema,
  updateTeamMemberRoleSchema,
  acceptTeamInviteSchema,
} from "@repo/api/workspaces/schemas";
import { TeamServiceError } from "@repo/api/workspaces/team-errors";
import { resolveWorkspacePlan } from "@repo/api/workspaces/plan";

type TeamSession = { user: { id: string; email: string } } | null;

const unauthorized = () =>
  new TeamServiceError(401, "UNAUTHORIZED", "You must be signed in");
const forbidden = () =>
  new TeamServiceError(403, "FORBIDDEN", "You do not have access to this team");
const teamNotFound = () =>
  new TeamServiceError(404, "TEAM_NOT_FOUND", "Team not found");
const workspaceNotFound = () =>
  new TeamServiceError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
const memberNotFound = () =>
  new TeamServiceError(404, "MEMBER_NOT_FOUND", "Member not found");
const inviteNotFound = () =>
  new TeamServiceError(404, "INVITE_NOT_FOUND", "Invite not found");
const inviteExpired = () =>
  new TeamServiceError(410, "INVITE_EXPIRED", "This invite has expired");
const inviteConflict = () =>
  new TeamServiceError(409, "INVITE_CONFLICT", "This person is already a member");

const ownerRequired = (action: string) =>
  new TeamServiceError(
    403,
    "OWNER_REQUIRED",
    `Only the team owner can ${action}`,
  );

const cannotRemoveOwner = () =>
  new TeamServiceError(400, "CANNOT_REMOVE_OWNER", "Cannot remove the team owner");

const cannotChangeOwnerRole = () =>
  new TeamServiceError(400, "CANNOT_CHANGE_OWNER_ROLE", "Cannot change the owner's role");

function generateInviteToken(): string {
  return randomUUID();
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Team service: manages teams inside workspaces, team members, and team invites.
 * Teams are scoped to a workspace — they inherit the workspace's plan.
 */
export function createTeamService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<TeamSession>;
}) {
  const { db, getSession } = deps;

  /** Finds a team and verifies the session user is a member. */
  const requireTeamMembership = async (
    teamId: string,
    userId: string,
  ) => {
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw forbidden();
    return membership;
  };

  /** Finds a team and verifies the session user is an admin or owner. */
  const requireTeamAdmin = async (
    teamId: string,
    userId: string,
  ) => {
    const membership = await requireTeamMembership(teamId, userId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw forbidden();
    }
    return membership;
  };

  /** Finds a team by ID. */
  const requireTeam = async (teamId: string) => {
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (!team) throw teamNotFound();
    return team;
  };

  /** Lists teams in a workspace the session user can see. */
  const listTeams = async (workspaceId: string, headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [workspaceMembership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!workspaceMembership) throw forbidden();

    const canSeeAllTeams =
      workspaceMembership.role === "owner" ||
      workspaceMembership.role === "admin";

    const rows = await db
      .select({
        team: teams,
        role: teamMembers.role,
      })
      .from(teams)
      .leftJoin(
        teamMembers,
        and(
          eq(teamMembers.teamId, teams.id),
          eq(teamMembers.userId, session.user.id),
        ),
      )
      .where(eq(teams.workspaceId, workspaceId))
      .orderBy(teams.createdAt);

    return rows
      .filter(({ role }) => canSeeAllTeams || role !== null)
      .map(({ team, role }) => ({ ...team, role }));
  };

  /** Returns a team if the session user is a member. */
  const getTeam = async (teamId: string, headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamMembership(teamId, session.user.id);
    return requireTeam(teamId);
  };

  /** Creates a team inside a workspace. */
  const createTeam = async (
    input: { name: string; workspaceId: string },
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    const body = createTeamSchema.parse(input);

    // Verify the workspace exists and the user can manage it.
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, body.workspaceId))
      .limit(1);
    if (!workspace) throw workspaceNotFound();

    const [workspaceMembership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, body.workspaceId),
          eq(workspaceMembers.userId, session.user.id),
        ),
      )
      .limit(1);
    if (!workspaceMembership) throw forbidden();
    if (
      workspaceMembership.role !== "owner" &&
      workspaceMembership.role !== "admin"
    ) {
      throw new TeamServiceError(
        403,
        "ADMIN_REQUIRED",
        "Only workspace owners and admins can create teams",
      );
    }

    const [plan, teamCountRow] = await Promise.all([
      resolveWorkspacePlan(db, body.workspaceId),
      db
        .select({ teamCount: count() })
        .from(teams)
        .where(eq(teams.workspaceId, body.workspaceId)),
    ]);
    assertCanCreateTeam(
      getPlanLimits(plan),
      teamCountRow[0]?.teamCount ?? 0,
    );

    const [created] = await db
      .insert(teams)
      .values({
        workspaceId: body.workspaceId,
        name: body.name,
        ownerId: session.user.id,
      })
      .returning();
    if (!created) {
      throw new TeamServiceError(500, "CREATE_FAILED", "Failed to create team");
    }

    // No transaction on the neon-http driver: remove the orphaned team if the
    // owner membership cannot be written.
    try {
      await db.insert(teamMembers).values({
        teamId: created.id,
        userId: session.user.id,
        role: "owner",
      });
    } catch (error) {
      await db.delete(teams).where(eq(teams.id, created.id));
      throw error;
    }

    return created;
  };

  /** Renames a team. Owners and admins may. */
  const updateTeam = async (
    teamId: string,
    input: { name: string },
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamAdmin(teamId, session.user.id);

    const body = renameTeamSchema.parse(input);

    const [updated] = await db
      .update(teams)
      .set({ name: body.name, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
      .returning();

    if (!updated) throw teamNotFound();
    return updated;
  };

  /** Deletes a team and its memberships and pending invites. */
  const deleteTeam = async (teamId: string, headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamAdmin(teamId, session.user.id);

    const team = await requireTeam(teamId);
    if (team.ownerId !== session.user.id) {
      throw ownerRequired("delete a team");
    }

    await db.delete(teams).where(eq(teams.id, teamId));
  };

  /** Lists all members of a team. */
  const listTeamMembers = async (teamId: string, headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamMembership(teamId, session.user.id);

    const members = await db
      .select({
        member: teamMembers,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(teamMembers)
      .innerJoin(user, eq(teamMembers.userId, user.id))
      .where(eq(teamMembers.teamId, teamId));

    return members;
  };

  /** Sends an invite to join a team. */
  const inviteTeamMember = async (
    teamId: string,
    input: { email: string; role: string },
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamAdmin(teamId, session.user.id);

    const body = inviteTeamMemberSchema.parse(input);
    const team = await requireTeam(teamId);

    const normalizedEmail = body.email.toLowerCase();

    // Check if already a member
    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, existingUser.id),
          ),
        )
        .limit(1);
      if (existingMember) throw inviteConflict();
    }

    // Check for pending invite
    const [existingInvite] = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          eq(teamInvites.email, normalizedEmail),
        ),
      )
      .limit(1);

    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const savedInvite = existingInvite
      ? (
          await db
            .update(teamInvites)
            .set({
              role: body.role,
              token: generateInviteToken(),
              invitedBy: session.user.id,
              expiresAt,
            })
            .where(eq(teamInvites.id, existingInvite.id))
            .returning()
        )[0]
      : (
          await db
            .insert(teamInvites)
            .values({
              teamId,
              email: normalizedEmail,
              role: body.role,
              token: generateInviteToken(),
              invitedBy: session.user.id,
              expiresAt,
            })
            .returning()
        )[0];

    if (!savedInvite) {
      throw new TeamServiceError(500, "INVITE_FAILED", "Failed to create the invite");
    }

    return { invite: savedInvite, team, inviteUrl: inviteUrl(savedInvite.token) };
  };

  /** Lists pending invites for a team. Only managers see bearer tokens. */
  const listTeamInvites = async (teamId: string, headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamAdmin(teamId, session.user.id);

    return db.select().from(teamInvites).where(eq(teamInvites.teamId, teamId));
  };

  /** Accepts a team invite by token. */
  const acceptTeamInvite = async (
    input: { token: string },
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    const body = acceptTeamInviteSchema.parse(input);

    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(eq(teamInvites.token, body.token))
      .limit(1);

    if (!invite) throw inviteNotFound();
    if (new Date(invite.expiresAt) < new Date()) throw inviteExpired();

    // Invite links are bearer tokens, but they are addressed to one person.
    // Requiring the signed-in email to match stops a forwarded link from
    // granting membership to someone the team did not invite.
    if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
      throw new TeamServiceError(
        403,
        "INVITE_EMAIL_MISMATCH",
        "This invite was sent to a different email address",
      );
    }

    const [team] = await db
      .select({ workspaceId: teams.workspaceId })
      .from(teams)
      .where(eq(teams.id, invite.teamId))
      .limit(1);

    const [existingMember] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, invite.teamId),
          eq(teamMembers.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!existingMember) {
      await db
        .insert(teamMembers)
        .values({
          teamId: invite.teamId,
          userId: session.user.id,
          role: invite.role,
        })
        .onConflictDoNothing();
    }

    await db.delete(teamInvites).where(eq(teamInvites.id, invite.id));

    return { teamId: invite.teamId, workspaceId: team?.workspaceId ?? null };
  };

  /** Updates a member's role. */
  const updateTeamMemberRole = async (
    teamId: string,
    input: { memberId: string; role: string },
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    const actor = await requireTeamAdmin(teamId, session.user.id);

    const body = updateTeamMemberRoleSchema.parse(input);

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.id, body.memberId),
        ),
      )
      .limit(1);

    if (!member) throw memberNotFound();
    if (member.role === "owner") throw cannotChangeOwnerRole();

    if (member.role === "admin" && actor.role !== "owner") {
      throw ownerRequired("change another admin's role");
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role: body.role })
      .where(eq(teamMembers.id, body.memberId))
      .returning();

    return updated;
  };

  /** Removes a member from a team. */
  const removeTeamMember = async (
    teamId: string,
    memberId: string,
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    const actor = await requireTeamAdmin(teamId, session.user.id);

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.id, memberId),
        ),
      )
      .limit(1);

    if (!member) throw memberNotFound();
    if (member.role === "owner") throw cannotRemoveOwner();
    if (member.role === "admin" && actor.role !== "owner") {
      throw ownerRequired("remove another admin");
    }

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
  };

  /** Revokes a pending team invite. */
  const revokeTeamInvite = async (
    teamId: string,
    inviteId: string,
    headers: Headers,
  ) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    await requireTeamAdmin(teamId, session.user.id);

    await db
      .delete(teamInvites)
      .where(
        and(
          eq(teamInvites.teamId, teamId),
          eq(teamInvites.id, inviteId),
        ),
      );
  };

  return {
    listTeams,
    getTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    listTeamMembers,
    inviteTeamMember,
    listTeamInvites,
    acceptTeamInvite,
    updateTeamMemberRole,
    removeTeamMember,
    revokeTeamInvite,
  };
}

export type TeamService = ReturnType<typeof createTeamService>;

function inviteUrl(token: string): string {
  const base =
    process.env.BASE_APP_URL ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/accept-team-invite?token=${encodeURIComponent(token)}`;
}
