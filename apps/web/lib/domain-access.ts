import {
  findDomainAccess,
  roleCanEditDomainData,
} from "@repo/api/workspaces/access";
import type { WorkspaceRole } from "@repo/api/workspaces/roles";
import { db } from "@repo/database";

/**
 * Route-level bridge to the one domain-access rule. Services own their own
 * errors; the few route handlers that call the portal service directly use
 * this instead, so a signed-in user cannot read or change another workspace's
 * bookings by supplying a domain or booking id.
 */
export type DomainAccessResult =
  | { ok: true; domainId: string; workspaceId: string; role: WorkspaceRole }
  | { ok: false; status: 403 | 404; code: string; message: string };

export async function checkDomainAccess(
  domainId: string,
  userId: string,
  options: { mutate?: boolean; hideForbidden?: boolean } = {},
): Promise<DomainAccessResult> {
  const access = await findDomainAccess(db, domainId, userId);

  if (access.kind === "not_found") {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: "Domain not found",
    };
  }

  if (access.kind === "forbidden") {
    return options.hideForbidden
      ? {
          ok: false,
          status: 404,
          code: "NOT_FOUND",
          message: "Domain not found",
        }
      : {
          ok: false,
          status: 403,
          code: "FORBIDDEN",
          message: "You are not a member of this domain's workspace",
        };
  }

  if (options.mutate && !roleCanEditDomainData(access.role)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Viewers can only read this domain",
    };
  }

  return {
    ok: true,
    domainId: access.domain.id,
    workspaceId: access.domain.workspaceId,
    role: access.role,
  };
}
