import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveWorkspaceId: vi.fn(),
  getWorkspace: vi.fn(),
}));

vi.mock("@/services/workspace-service", () => ({
  workspaceService: mocks,
}));

import {
  WORKSPACE_EDITOR_ROLES,
  WORKSPACE_OWNER_ROLES,
  getActiveWorkspaceAccess,
} from "@/lib/workspace-access";

const requestHeaders = new Headers();

describe("getActiveWorkspaceAccess", () => {
  beforeEach(() => {
    mocks.getActiveWorkspaceId.mockReset();
    mocks.getWorkspace.mockReset();
  });

  it("reports a missing active workspace", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);

    await expect(
      getActiveWorkspaceAccess(requestHeaders, WORKSPACE_EDITOR_ROLES),
    ).resolves.toEqual({
      ok: false,
      status: 404,
      code: "NO_ACTIVE_WORKSPACE",
      message: "Select a workspace first",
    });
  });

  it("keeps viewers out of editor-only actions", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue("workspace-1");
    mocks.getWorkspace.mockResolvedValue({ role: "viewer" });

    await expect(
      getActiveWorkspaceAccess(requestHeaders, WORKSPACE_EDITOR_ROLES),
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("lets members edit shared data", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue("workspace-1");
    mocks.getWorkspace.mockResolvedValue({ role: "member" });

    await expect(
      getActiveWorkspaceAccess(requestHeaders, WORKSPACE_EDITOR_ROLES),
    ).resolves.toEqual({
      ok: true,
      workspaceId: "workspace-1",
      role: "member",
    });
  });

  it("reserves billing for the workspace owner", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue("workspace-1");
    mocks.getWorkspace.mockResolvedValue({ role: "admin" });

    await expect(
      getActiveWorkspaceAccess(requestHeaders, WORKSPACE_OWNER_ROLES),
    ).resolves.toMatchObject({
      ok: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });
});
