import { and, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains, type Domain } from "@repo/database/schema/domains";
import { workspaceMembers } from "@repo/database/schema/workspaces";
import {
  canEditWorkspace,
  type WorkspaceRole,
} from "@repo/api/workspaces/roles";

/**
 * The single access rule for domain-scoped data:
 *
 *   membership in the domain's workspace grants access;
 *   the membership role decides whether the caller may change anything.
 *
 * `domains.ownerId` is the creator/audit column and is deliberately not
 * consulted here. Services map the result onto their own error classes so the
 * HTTP shape of each module stays unchanged.
 */
export type DomainAccess =
  | { kind: "ok"; domain: Domain; role: WorkspaceRole }
  | { kind: "not_found" }
  | { kind: "forbidden" };

/**
 * Looks up a domain and the caller's membership in its workspace.
 *
 * Returns `not_found` when the domain does not exist and `forbidden` when it
 * exists but the caller is not a member. Callers that must not reveal a
 * domain's existence can collapse both into a 404.
 */
export async function findDomainAccess(
  db: Database,
  domainId: string,
  userId: string,
): Promise<DomainAccess> {
  const [domain] = await db
    .select()
    .from(domains)
    .where(eq(domains.id, domainId))
    .limit(1);

  if (!domain) return { kind: "not_found" };

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, domain.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) return { kind: "forbidden" };

  return { kind: "ok", domain, role: membership.role };
}

/** Returns the caller's role in a workspace, or null when not a member. */
export async function findWorkspaceRole(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  return membership?.role ?? null;
}

/**
 * True when the role may create, edit, or delete domain-scoped data.
 * Viewers are read-only; owners, admins, and members can edit.
 */
export function roleCanEditDomainData(role: WorkspaceRole): boolean {
  return canEditWorkspace(role);
}
