import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Browser } from "@playwright/test";

// A failed test skips the rest instead of restarting the worker, which would
// re-run beforeAll and burn the auth sign-up rate limit.
test.describe.configure({ mode: "serial" });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const password = "E2ePassword123!";
const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;

type Role = "owner" | "admin" | "viewer";
type TestUser = { id: string; email: string };

let sql: ReturnType<typeof neon>;
let workspaceId: string | undefined;
let domainOneName: string;
let domainTwoName: string;
const userIds: string[] = [];
const users = {} as Record<Role, TestUser>;

async function signUp(
  request: APIRequestContext,
  role: Role,
): Promise<TestUser> {
  const email = `e2e-${runId}-${role}@example.com`;
  const response = await request.post(`${baseURL}/api/auth/sign-up/email`, {
    data: { name: `E2E ${role}`, email, password },
    headers: { origin: baseURL },
  });
  if (!response.ok()) {
    throw new Error(
      `Sign-up for ${role} failed (${response.status()}): ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { user?: { id?: string } };
  if (!body.user?.id) {
    throw new Error(`Sign-up for ${role} returned no user id`);
  }
  userIds.push(body.user.id);
  return { id: body.user.id, email };
}

async function signIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${baseURL}/api/auth/sign-in/email`,
    {
      data: { email, password },
      headers: { origin: baseURL },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `Sign-in for ${email} failed (${response.status()}): ${await response.text()}`,
    );
  }
  return { context, page: await context.newPage() };
}

test.beforeAll(async ({ request }) => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "E2E_DATABASE_URL is required; point it at a disposable database branch",
    );
  }
  sql = neon(databaseUrl);

  users.owner = await signUp(request, "owner");
  users.admin = await signUp(request, "admin");
  users.viewer = await signUp(request, "viewer");

  const [workspace] = await sql`
    insert into workspaces (name, owner_id)
    values (${`E2E workspace ${runId}`}, ${users.owner.id})
    returning id
  `;
  workspaceId = workspace.id as string;

  for (const [user, role] of [
    [users.owner, "owner"],
    [users.admin, "admin"],
    [users.viewer, "viewer"],
  ] as const) {
    await sql`
      insert into workspace_members (workspace_id, user_id, role)
      values (${workspaceId}, ${user.id}, ${role})
    `;
  }

  await sql`
    insert into subscriptions (owner_id, plan, status)
    values (${users.owner.id}, 'ultimate', 'active')
  `;

  domainOneName = `E2E One ${runId}`;
  domainTwoName = `E2E Two ${runId}`;

  const [domainOne] = await sql`
    insert into domains (owner_id, workspace_id, name, slug, embed_secret)
    values (
      ${users.owner.id},
      ${workspaceId},
      ${domainOneName},
      ${`e2e-${runId}-one`},
      ${randomUUID()}
    )
    returning id
  `;
  const [domainTwo] = await sql`
    insert into domains (owner_id, workspace_id, name, slug, embed_secret)
    values (
      ${users.owner.id},
      ${workspaceId},
      ${domainTwoName},
      ${`e2e-${runId}-two`},
      ${randomUUID()}
    )
    returning id
  `;

  const [agentOne] = await sql`
    insert into agents (domain_id, name)
    values (${domainOne.id}, ${`E2E agent one ${runId}`})
    returning id
  `;
  const [agentTwo] = await sql`
    insert into agents (domain_id, name)
    values (${domainTwo.id}, ${`E2E agent two ${runId}`})
    returning id
  `;

  await sql`
    insert into conversations (agent_id, title)
    values (${agentOne.id}, 'E2E conversation one')
  `;
  await sql`
    insert into conversations (agent_id, title)
    values (${agentTwo.id}, 'E2E conversation two')
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  if (workspaceId) {
    await sql`delete from domains where workspace_id = ${workspaceId}`;
    await sql`delete from workspaces where id = ${workspaceId}`;
  }
  for (const userId of userIds) {
    await sql`delete from "user" where id = ${userId}`;
  }
});

test("owner sees both domains, can reply, and can manage billing", async ({
  browser,
}) => {
  const { context, page } = await signIn(browser, users.owner.email);
  try {
    await page.goto(`${baseURL}/dashboard/conversations`);
    await expect(
      page.getByRole("heading", { name: "Conversations" }),
    ).toBeVisible();
    await expect(page.getByText("E2E conversation one")).toBeVisible();
    await expect(page.getByText("E2E conversation two")).toBeVisible();

    await page.getByRole("link", { name: domainOneName }).click();
    await expect(page.getByText("E2E conversation one")).toBeVisible();
    await expect(page.getByText("E2E conversation two")).toHaveCount(0);

    await page.getByRole("link", { name: "All domains" }).click();
    await page.getByText("E2E conversation one").click();
    await expect(page.getByPlaceholder(/Reply as the business/)).toBeVisible();

    await page.goto(`${baseURL}/dashboard/billing`);
    await expect(
      page.getByText(/This workspace is on the Enterprise plan/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Upgrade" }).first(),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("admin sees the shared inbox but cannot change billing", async ({
  browser,
}) => {
  const { context, page } = await signIn(browser, users.admin.email);
  try {
    await page.goto(`${baseURL}/dashboard/conversations`);
    await expect(page.getByText("E2E conversation one")).toBeVisible();
    await expect(page.getByText("E2E conversation two")).toBeVisible();
    await page.getByText("E2E conversation one").click();
    await expect(page.getByPlaceholder(/Reply as the business/)).toBeVisible();

    await page.goto(`${baseURL}/dashboard/billing`);
    await expect(
      page.getByText(/This workspace is on the Enterprise plan/),
    ).toBeVisible();
    await expect(
      page.getByText("Only the workspace owner can change the plan."),
    ).toHaveCount(3);
    await expect(
      page.getByRole("button", { name: "Upgrade" }),
    ).toHaveCount(0);

    const checkout = await context.request.post(
      `${baseURL}/api/billing/checkout`,
      { data: { plan: "standard" }, headers: { origin: baseURL } },
    );
    expect(checkout.status()).toBe(403);
  } finally {
    await context.close();
  }
});

test("viewer reads both domains but cannot reply or create campaigns", async ({
  browser,
}) => {
  const { context, page } = await signIn(browser, users.viewer.email);
  try {
    await page.goto(`${baseURL}/dashboard/conversations`);
    await expect(page.getByText("E2E conversation one")).toBeVisible();
    await expect(page.getByText("E2E conversation two")).toBeVisible();
    await page.getByText("E2E conversation one").click();
    await expect(
      page.getByText(/You have viewer access to this workspace/),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/Reply as the business/)).toHaveCount(0);

    await page.goto(`${baseURL}/dashboard/campaigns`);
    await expect(
      page.getByText(
        "Viewers can read campaigns but cannot create, schedule, or send them.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New campaign" }),
    ).toHaveCount(0);

    const createCampaign = await context.request.post(
      `${baseURL}/api/campaigns`,
      {
        data: {
          name: "E2E blocked campaign",
          subject: "Blocked",
          body: "Viewers cannot send this.",
          audience: "all",
        },
        headers: { origin: baseURL },
      },
    );
    expect(createCampaign.status()).toBe(403);
  } finally {
    await context.close();
  }
});
