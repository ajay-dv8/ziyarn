import { randomBytes } from "node:crypto";

import { and, count, eq, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
} from "@repo/database/schema/workspaces";
import { user } from "@repo/database/schema/auth";
import { domains } from "@repo/database/schema/domains";
import { getPlanLimits, planSchema } from "@repo/api/plans";
import type { Plan } from "@repo/api/plans/schemas";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  acceptInviteSchema,
  type CreateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type AcceptInviteInput,
} from "@repo/api/workspaces/schemas";

export type SessionWithUser = {
  user: { id: string };
} | null;

export class WorkspaceServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

const unauthorized = () =>
  new WorkspaceServiceError(401, "UNAUTHORIZED", "You must be signed in");

const forbidden = () =>
  new WorkspaceServiceError(
    403,
    "FORBIDDEN",
    "You do not have access to this workspace",
  );

const notFound = () =>
  new WorkspaceServiceError(404, "NOT_FOUND", "Workspace not found");

const inviteNotFound = () =>
  new WorkspaceServiceError(404, "INVITE_NOT_FOUND", "Invite not found");

const memberNotFound = () =>
  new WorkspaceServiceError(404, "MEMBER_NOT_FOUND", "Member not found");

const inviteExpired = () =>
  new WorkspaceServiceError(410, "INVITE_EXPIRED", "This invite has expired");

const inviteConflict = () =>
  new WorkspaceServiceError(
    409,
    "INVITE_CONFLICT",
    "This person is already a member",
  );

const ownerRequired = () =>
  new WorkspaceServiceError(
    403,
    "OWNER_REQUIRED",
    "Only the workspace owner can do this",
  );

const cannotRemoveOwner = () =>
  new WorkspaceServiceError(
    400,
    "CANNOT_REMOVE_OWNER",
    "Cannot remove the workspace owner",
  );

const cannotChangeOwnerRole = () =>
  new WorkspaceServiceError(
    400,
    "CANNOT_CHANGE_OWNER_ROLE",
    "Cannot change the owner's role",
  );

function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Workspace service: manages workspaces, members, and invites.
 * Each workspace owns domains and has a plan applied to all its domains.
 */
export function createWorkspaceService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  /** Finds a workspace the user is a member of. */
  const requireWorkspaceMembership = async (
    workspaceId: string,
    userId: string,
  ) => {
    const [membership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) throw forbidden();
    return membership;
  };

  /** Finds a workspace and verifies the user is an admin or owner. */
  const requireWorkspaceAdmin = async (
    workspaceId: string,
    userId: string,
  ) => {
    const membership = await requireWorkspaceMembership(workspaceId, userId);
    if (membership.role !== "owner" && membership.role !== "admin") {
      throw forbidden();
    }
    return membership;
  };

  /** Finds a workspace by ID. */
  const requireWorkspace = async (workspaceId: string) => {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!workspace) throw notFound();
    return workspace;
  };

  /** Checks if a user can add more members based on plan limits. */
  const assertCanAddMember = (plan: Plan, currentCount: number) => {
    const limits = getPlanLimits(plan);
    if (currentCount >= limits.maxMembers) {
      throw new WorkspaceServiceError(
        429,
        "MEMBER_LIMIT_EXCEEDED",
        `Your plan allows at most ${limits.maxMembers} team members`,
      );
    }
  };

  return {
    /** Lists workspaces the user belongs to. */
    listWorkspaces: async (headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      const memberships = await db
        .select({
          workspace: workspaces,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(workspaceMembers.userId, session.user.id));

      return memberships.map(({ workspace, role }) => ({
        ...workspace,
        role,
      }));
    },

    /** Returns a workspace if the user is a member. */
    getWorkspace: async (workspaceId: string, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceMembership(workspaceId, session.user.id);
      return requireWorkspace(workspaceId);
    },

    /** Creates a workspace and makes the creator the owner. */
    createWorkspace: async (input: CreateWorkspaceInput, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      const body = createWorkspaceSchema.parse(input);

      const [created] = await db
        .insert(workspaces)
        .values({
          name: body.name,
          ownerId: session.user.id,
        })
        .returning();

      if (!created) {
        throw new WorkspaceServiceError(
          500,
          "CREATE_FAILED",
          "Failed to create workspace",
        );
      }

      await db.insert(workspaceMembers).values({
        workspaceId: created.id,
        userId: session.user.id,
        role: "owner",
      });

      return created;
    },

    /** Lists all members of a workspace. */
    listMembers: async (workspaceId: string, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceMembership(workspaceId, session.user.id);

      const members = await db
        .select({
          member: workspaceMembers,
          userName: user.name,
          userEmail: user.email,
          userImage: user.image,
        })
        .from(workspaceMembers)
        .innerJoin(user, eq(workspaceMembers.userId, user.id))
        .where(eq(workspaceMembers.workspaceId, workspaceId));

      return members;
    },

    /** Sends an invite to join a workspace. */
    inviteMember: async (
      workspaceId: string,
      input: InviteMemberInput,
      headers: Headers,
    ) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceAdmin(workspaceId, session.user.id);

      const body = inviteMemberSchema.parse(input);
      const workspace = await requireWorkspace(workspaceId);

      // Enforce maxMembers plan limit
      const memberUserIds = db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .as("member_user_ids");

      const [planRow] = await db
        .select({
          effectivePlan: sql<string>`COALESCE(MAX(${domains.plan}), 'free')`,
        })
        .from(domains)
        .where(
          sql`${domains.ownerId} IN (SELECT user_id FROM ${memberUserIds})`,
        );

      const plan = planSchema.parse(planRow?.effectivePlan ?? "free");

      const [memberCountRow] = await db
        .select({ memberCount: count() })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId));

      const [inviteCountRow] = await db
        .select({ inviteCount: count() })
        .from(workspaceInvites)
        .where(eq(workspaceInvites.workspaceId, workspaceId));

      assertCanAddMember(plan, (memberCountRow?.memberCount ?? 0) + (inviteCountRow?.inviteCount ?? 0));

      // Check if already a member
      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, body.email))
        .limit(1);

      if (existingUser) {
        const [existingMember] = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, existingUser.id),
            ),
          )
          .limit(1);

        if (existingMember) throw inviteConflict();
      }

      // Check for pending invite
      const [existingInvite] = await db
        .select()
        .from(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, workspaceId),
            eq(workspaceInvites.email, body.email),
          ),
        )
        .limit(1);

      if (existingInvite) {
        // Update existing invite
        const [updated] = await db
          .update(workspaceInvites)
          .set({
            role: body.role,
            token: generateInviteToken(),
            invitedBy: session.user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          })
          .where(eq(workspaceInvites.id, existingInvite.id))
          .returning();
        return { invite: updated, workspace };
      }

      const [invite] = await db
        .insert(workspaceInvites)
        .values({
          workspaceId,
          email: body.email,
          role: body.role,
          token: generateInviteToken(),
          invitedBy: session.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .returning();

      return { invite, workspace };
    },

    /** Lists pending invites for a workspace. */
    listInvites: async (workspaceId: string, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceMembership(workspaceId, session.user.id);

      return db
        .select()
        .from(workspaceInvites)
        .where(eq(workspaceInvites.workspaceId, workspaceId));
    },

    /** Accepts a workspace invite by token. */
    acceptInvite: async (input: AcceptInviteInput, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      const body = acceptInviteSchema.parse(input);

      const [invite] = await db
        .select()
        .from(workspaceInvites)
        .where(eq(workspaceInvites.token, body.token))
        .limit(1);

      if (!invite) throw inviteNotFound();
      if (new Date(invite.expiresAt) < new Date()) throw inviteExpired();

      // Check if already a member
      const [existingMember] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invite.workspaceId),
            eq(workspaceMembers.userId, session.user.id),
          ),
        )
        .limit(1);

      if (!existingMember) {
        await db.insert(workspaceMembers).values({
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          role: invite.role,
        });
      }

      // Delete the invite
      await db
        .delete(workspaceInvites)
        .where(eq(workspaceInvites.id, invite.id));

      return { workspaceId: invite.workspaceId };
    },

    /** Updates a member's role. */
    updateMemberRole: async (
      workspaceId: string,
      input: UpdateMemberRoleInput,
      headers: Headers,
    ) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceAdmin(workspaceId, session.user.id);

      const body = updateMemberRoleSchema.parse(input);

      const [member] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.id, body.memberId),
          ),
        )
        .limit(1);

      if (!member) throw memberNotFound();
      if (member.role === "owner") throw cannotChangeOwnerRole();

      const [updated] = await db
        .update(workspaceMembers)
        .set({ role: body.role })
        .where(eq(workspaceMembers.id, body.memberId))
        .returning();

      return updated;
    },

    /** Removes a member from a workspace. */
    removeMember: async (
      workspaceId: string,
      memberId: string,
      headers: Headers,
    ) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceAdmin(workspaceId, session.user.id);

      const [member] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.id, memberId),
          ),
        )
        .limit(1);

      if (!member) throw memberNotFound();
      if (member.role === "owner") throw cannotRemoveOwner();

      await db
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.id, memberId));
    },

    /** Revokes a pending invite. */
    revokeInvite: async (
      workspaceId: string,
      inviteId: string,
      headers: Headers,
    ) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceAdmin(workspaceId, session.user.id);

      await db
        .delete(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, workspaceId),
            eq(workspaceInvites.id, inviteId),
          ),
        );
    },

    /** Gets the workspace that owns a domain. */
    getWorkspaceForDomain: async (domainId: string) => {
      const [domain] = await db
        .select({ ownerId: domains.ownerId })
        .from(domains)
        .where(eq(domains.id, domainId))
        .limit(1);

      if (!domain) return null;

      // Find workspace where the domain owner is a member
      const [membership] = await db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          workspace: workspaces,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(eq(workspaceMembers.userId, domain.ownerId))
        .limit(1);

      return membership?.workspace ?? null;
    },

    /** Counts members in a workspace. */
    countMembers: async (workspaceId: string) => {
      const [row] = await db
        .select({ count: count() })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId));

      return row?.count ?? 0;
    },
  };
}

const workspaceService = {} as ReturnType<typeof createWorkspaceService>;
export type WorkspaceService = typeof workspaceService;
