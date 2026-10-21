import { randomBytes } from "node:crypto";

import { and, count, eq, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
} from "@repo/database/schema/workspaces";
import { user } from "@repo/database/schema/auth";
import { domains } from "@repo/database/schema/domains";
import { getPlanLimits, highestPlan } from "@repo/api/plans";
import { assertCanCreateWorkspace } from "@repo/api/plans/server";
import { APP_ROUTES, absoluteUrl } from "@repo/routes";
import type { Plan } from "@repo/api/plans/schemas";
import {
  createWorkspaceSchema,
  renameWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  acceptInviteSchema,
  type CreateWorkspaceInput,
  type RenameWorkspaceInput,
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

/** Admins manage members and viewers; only the owner manages admins. */
const ownerRequired = (action: string) =>
  new WorkspaceServiceError(
    403,
    "OWNER_REQUIRED",
    `Only the workspace owner can ${action}`,
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

/** Invite links are absolute so they work pasted into any mail client. */
function appBaseUrl(): string {
  return (
    process.env.BASE_APP_URL ??
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function inviteUrl(token: string): string {
  return `${absoluteUrl(appBaseUrl(), APP_ROUTES.ACCEPT_INVITE)}?token=${encodeURIComponent(token)}`;
}

/** How long an invite stays acceptable. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

  /**
   * The plan a workspace's limits are read from: the highest plan among the
   * domains owned by anyone in it. A workspace with no domains yet is "free",
   * which is what an owner sees before their first domain exists.
   */
  const resolveWorkspacePlan = async (workspaceId: string): Promise<Plan> => {
    // Two queries rather than a sub-select: passing a drizzle sub-query to
    // inArray() serialises as "[object Object]" on this driver.
    const memberRows = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    const memberUserIds = memberRows.map((row) => row.userId);
    if (memberUserIds.length === 0) return "free";

    const ownedDomains = await db
      .select({ plan: domains.plan })
      .from(domains)
      .where(inArray(domains.ownerId, memberUserIds));

    return highestPlan(ownedDomains.map((row) => row.plan));
  };

  /**
   * The plan that applies to a person: the highest plan among their domains.
   * Used for the per-user workspace limit, which is not tied to any one
   * workspace.
   */
  const resolveUserPlan = async (userId: string): Promise<Plan> => {
    const ownedDomains = await db
      .select({ plan: domains.plan })
      .from(domains)
      .where(eq(domains.ownerId, userId));

    return highestPlan(ownedDomains.map((row) => row.plan));
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

      const [existingWorkspaces, plan] = await Promise.all([
        db
          .select({ id: workspaces.id })
          .from(workspaceMembers)
          .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
          .where(eq(workspaceMembers.userId, session.user.id)),
        resolveUserPlan(session.user.id),
      ]);

      assertCanCreateWorkspace(getPlanLimits(plan), existingWorkspaces.length);

      // No transaction: the neon-http driver this app connects through has
      // none. Instead the owner row is compensated for — a workspace nobody
      // can administer is worse than no workspace, so it is removed again.
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

      try {
        await db.insert(workspaceMembers).values({
          workspaceId: created.id,
          userId: session.user.id,
          role: "owner",
        });
      } catch (error) {
        await db.delete(workspaces).where(eq(workspaces.id, created.id));
        throw error;
      }

      return created;
    },

    /** Renames a workspace. Owners and admins may. */
    updateWorkspace: async (
      workspaceId: string,
      input: RenameWorkspaceInput,
      headers: Headers,
    ) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceAdmin(workspaceId, session.user.id);

      const body = renameWorkspaceSchema.parse(input);

      const [updated] = await db
        .update(workspaces)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId))
        .returning();

      if (!updated) throw notFound();
      return updated;
    },

    /**
     * Deletes a workspace with its memberships and pending invites (both
     * cascade). Domains are owned by a person, not by a team, so the caller's
     * agents and domains survive — losing the team costs the people in it their
     * shared access, which is why the UI confirms before calling this.
     */
    deleteWorkspace: async (workspaceId: string, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();
      await requireWorkspaceAdmin(workspaceId, session.user.id);

      await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
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

      // Seats are consumed by members AND pending invites, so both are counted
      // against the plan limit.
      const [plan, memberCountRow, inviteCountRow] = await Promise.all([
        resolveWorkspacePlan(workspaceId),
        db
          .select({ memberCount: count() })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, workspaceId)),
        db
          .select({ inviteCount: count() })
          .from(workspaceInvites)
          .where(eq(workspaceInvites.workspaceId, workspaceId)),
      ]);

      assertCanAddMember(
        plan,
        (memberCountRow[0]?.memberCount ?? 0) + (inviteCountRow[0]?.inviteCount ?? 0),
      );

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
            eq(workspaceInvites.email, normalizedEmail),
          ),
        )
        .limit(1);

      // Re-inviting refreshes the existing invite rather than adding a seat,
      // so an owner who mistyped the role does not burn two seats.
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      const savedInvite = existingInvite
        ? (
            await db
              .update(workspaceInvites)
              .set({
                role: body.role,
                token: generateInviteToken(),
                invitedBy: session.user.id,
                expiresAt,
              })
              .where(eq(workspaceInvites.id, existingInvite.id))
              .returning()
          )[0]
        : (
            await db
              .insert(workspaceInvites)
              .values({
                workspaceId,
                email: normalizedEmail,
                role: body.role,
                token: generateInviteToken(),
                invitedBy: session.user.id,
                expiresAt,
              })
              .returning()
          )[0];

      if (!savedInvite) {
        throw new WorkspaceServiceError(
          500,
          "INVITE_FAILED",
          "Failed to create the invite",
        );
      }

      // The accept link is returned rather than emailed here: this module must
      // stay free of SMTP so it never drags nodemailer into a client bundle.
      return {
        invite: savedInvite,
        workspace,
        inviteUrl: inviteUrl(savedInvite.token),
      };
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

      // No transaction on this driver, so order the writes so the recoverable
      // failure is harmless: adding the member is idempotent (checked above),
      // and an invite left behind after a failed delete is simply re-accepted.
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

      await db.delete(workspaceInvites).where(eq(workspaceInvites.id, invite.id));

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
      const actor = await requireWorkspaceAdmin(workspaceId, session.user.id);

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

      // Only the owner manages admins. Everyone else manages members and
      // viewers — an admin cannot promote themselves or demote a peer.
      if (member.role === "admin" && actor.role !== "owner") {
        throw ownerRequired("change another admin's role");
      }

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
      const actor = await requireWorkspaceAdmin(workspaceId, session.user.id);

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
      // Only the owner removes an admin; anyone may remove themselves is not
      // offered here — leaving is a separate, deliberate action.
      if (member.role === "admin" && actor.role !== "owner") {
        throw ownerRequired("remove another admin");
      }

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

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
