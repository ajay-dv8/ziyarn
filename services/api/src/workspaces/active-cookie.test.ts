import { describe, expect, it } from "vitest";

import {
  ACTIVE_WORKSPACE_COOKIE,
  pickActiveWorkspaceId,
  readActiveWorkspaceCookie,
} from "@repo/api/workspaces/active-cookie";

describe("pickActiveWorkspaceId", () => {
  it("keeps the requested workspace when the user belongs to it", () => {
    expect(pickActiveWorkspaceId(["first", "second"], "second")).toBe("second");
  });

  it("ignores a workspace the user does not belong to", () => {
    expect(pickActiveWorkspaceId(["first", "second"], "someone-else")).toBe(
      "first",
    );
  });

  it("falls back to the first workspace when no cookie is set", () => {
    expect(pickActiveWorkspaceId(["first", "second"], null)).toBe("first");
  });

  it("returns null when the user has no workspaces", () => {
    expect(pickActiveWorkspaceId([], "second")).toBeNull();
  });
});

describe("readActiveWorkspaceCookie", () => {
  it("finds the workspace cookie among other cookies", () => {
    const headers = new Headers({
      cookie: `theme=dark; ${ACTIVE_WORKSPACE_COOKIE}=workspace-1; other=1`,
    });

    expect(readActiveWorkspaceCookie(headers)).toBe("workspace-1");
  });

  it("returns null when the cookie is missing", () => {
    expect(readActiveWorkspaceCookie(new Headers())).toBeNull();
    expect(readActiveWorkspaceCookie(new Headers({ cookie: "theme=dark" }))).toBeNull();
  });

  it("treats malformed encoding as absent", () => {
    const headers = new Headers({ cookie: `${ACTIVE_WORKSPACE_COOKIE}=%E0%A4%A` });

    expect(readActiveWorkspaceCookie(headers)).toBeNull();
  });
});
