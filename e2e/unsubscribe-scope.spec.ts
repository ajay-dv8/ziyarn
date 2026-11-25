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

type CustomerList = {
  customers: Array<{ id: string; email: string; blocked: boolean }>;
};

let sql: ReturnType<typeof neon>;
let userId: string;
let userEmail: string;
let workspaceOneId: string;
let workspaceTwoId: string;
let domainOneId: string;
let domainTwoId: string;
let customerOneId: string;
let campaignId: string;
let unsubscribeToken: string;
const sharedEmail = `e2e-unsub-${runId}@example.com`;

async function signUp(request: APIRequestContext): Promise<string> {
  userEmail = `e2e-unsub-owner-${runId}@example.com`;
  const response = await request.post(`${baseURL}/api/auth/sign-up/email`, {
    data: { name: "E2E unsubscribe owner", email: userEmail, password },
    headers: { origin: baseURL },
  });
  if (!response.ok()) {
    throw new Error(
      `Sign-up failed (${response.status()}): ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { user?: { id?: string } };
  if (!body.user?.id) {
    throw new Error("Sign-up returned no user id");
  }
  return body.user.id;
}

async function signIn(browser: Browser) {
  const context = await browser.newContext();
  const response = await context.request.post(
    `${baseURL}/api/auth/sign-in/email`,
    {
      data: { email: userEmail, password },
      headers: { origin: baseURL },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `Sign-in failed (${response.status()}): ${await response.text()}`,
    );
  }
  return { context, page: await context.newPage() };
}

async function listCustomers(
  request: APIRequestContext,
  domainId: string,
): Promise<CustomerList> {
  const response = await request.get(
    `${baseURL}/api/customers?domainId=${domainId}`,
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as CustomerList;
}

test.beforeAll(async ({ request }) => {
  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "E2E_DATABASE_URL is required; point it at a disposable database branch",
    );
  }
  sql = neon(databaseUrl);
  userId = await signUp(request);

  const [workspaceOne] = await sql`
    insert into workspaces (name, owner_id)
    values (${`E2E unsub one ${runId}`}, ${userId})
    returning id
  `;
  workspaceOneId = workspaceOne.id as string;
  const [workspaceTwo] = await sql`
    insert into workspaces (name, owner_id)
    values (${`E2E unsub two ${runId}`}, ${userId})
    returning id
  `;
  workspaceTwoId = workspaceTwo.id as string;

  for (const workspaceId of [workspaceOneId, workspaceTwoId]) {
    await sql`
      insert into workspace_members (workspace_id, user_id, role)
      values (${workspaceId}, ${userId}, 'owner')
    `;
  }

  const [domainOne] = await sql`
    insert into domains (owner_id, workspace_id, name, slug, embed_secret)
    values (
      ${userId},
      ${workspaceOneId},
      ${`E2E unsub domain one ${runId}`},
      ${`e2e-unsub-${runId}-one`},
      ${randomUUID()}
    )
    returning id
  `;
  domainOneId = domainOne.id as string;
  const [domainTwo] = await sql`
    insert into domains (owner_id, workspace_id, name, slug, embed_secret)
    values (
      ${userId},
      ${workspaceTwoId},
      ${`E2E unsub domain two ${runId}`},
      ${`e2e-unsub-${runId}-two`},
      ${randomUUID()}
    )
    returning id
  `;
  domainTwoId = domainTwo.id as string;

  const [customerOne] = await sql`
    insert into customers (domain_id, email_lower, email, name, source)
    values (${domainOneId}, ${sharedEmail}, ${sharedEmail}, 'Shared customer', 'site')
    returning id
  `;
  customerOneId = customerOne.id as string;
  await sql`
    insert into customers (domain_id, email_lower, email, name, source)
    values (${domainTwoId}, ${sharedEmail}, ${sharedEmail}, 'Shared customer', 'site')
  `;

  unsubscribeToken = `e2e-unsub-token-${runId}`;
  const [campaign] = await sql`
    insert into campaigns (workspace_id, owner_id, name, subject, body, status)
    values (
      ${workspaceTwoId},
      ${userId},
      ${`E2E unsubscribe campaign ${runId}`},
      'Subject',
      '<p>Body</p>',
      'sent'
    )
    returning id
  `;
  campaignId = campaign.id as string;
  await sql`
    insert into campaign_recipients (
      campaign_id,
      email,
      unsubscribe_token,
      status
    )
    values (${campaignId}, ${sharedEmail}, ${unsubscribeToken}, 'sent')
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`
    delete from domains
    where workspace_id in (${workspaceOneId}, ${workspaceTwoId})
  `;
  await sql`
    delete from campaigns
    where workspace_id in (${workspaceOneId}, ${workspaceTwoId})
  `;
  await sql`
    delete from workspaces
    where id in (${workspaceOneId}, ${workspaceTwoId})
  `;
  if (userId) {
    await sql`delete from "user" where id = ${userId}`;
  }
});

test("unsubscribes stay inside their workspace", async ({ browser }) => {
  const { context, page } = await signIn(browser);
  try {
    const before = await listCustomers(context.request, domainOneId);
    expect(before.customers[0]?.blocked).toBe(false);
    expect(before.customers[0]?.email).toBe(sharedEmail);

    const block = await context.request.post(`${baseURL}/api/customers`, {
      data: { action: "block", domainId: domainOneId, ids: [customerOneId] },
    });
    expect(block.ok()).toBeTruthy();
    expect(await block.json()).toEqual({ blocked: 1 });

    expect(
      (await listCustomers(context.request, domainOneId)).customers[0]?.blocked,
    ).toBe(true);
    expect(
      (await listCustomers(context.request, domainTwoId)).customers[0]?.blocked,
    ).toBe(false);

    const manualSuppression = await sql`
      select workspace_id
      from unsubscribed_emails
      where email = ${sharedEmail}
    `;
    expect(manualSuppression).toHaveLength(1);
    expect(manualSuppression[0]?.workspace_id).toBe(workspaceOneId);

    await page.goto(
      `${baseURL}/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}`,
    );
    await expect(
      page.getByRole("heading", { name: "You are unsubscribed" }),
    ).toBeVisible();

    expect(
      (await listCustomers(context.request, domainTwoId)).customers[0]?.blocked,
    ).toBe(true);
    expect(
      (await listCustomers(context.request, domainOneId)).customers[0]?.blocked,
    ).toBe(true);

    const [campaign] = await sql`
      select unsubscribed_count
      from campaigns
      where id = ${campaignId}
    `;
    expect(campaign?.unsubscribed_count).toBe(1);

    // Re-opening the link must not double-count or fail.
    await page.goto(
      `${baseURL}/unsubscribe?t=${encodeURIComponent(unsubscribeToken)}&again=1`,
    );
    await expect(
      page.getByRole("heading", { name: "You are unsubscribed" }),
    ).toBeVisible();
    const [repeated] = await sql`
      select unsubscribed_count
      from campaigns
      where id = ${campaignId}
    `;
    expect(repeated?.unsubscribed_count).toBe(1);

    const unblock = await context.request.post(`${baseURL}/api/customers`, {
      data: { action: "unblock", domainId: domainOneId, ids: [customerOneId] },
    });
    expect(unblock.ok()).toBeTruthy();
    expect(await unblock.json()).toEqual({ unblocked: 1 });

    expect(
      (await listCustomers(context.request, domainOneId)).customers[0]?.blocked,
    ).toBe(false);
    expect(
      (await listCustomers(context.request, domainTwoId)).customers[0]?.blocked,
    ).toBe(true);

    const finalSuppression = await sql`
      select workspace_id
      from unsubscribed_emails
      where email = ${sharedEmail}
    `;
    expect(finalSuppression).toHaveLength(1);
    expect(finalSuppression[0]?.workspace_id).toBe(workspaceTwoId);
  } finally {
    await context.close();
  }
});
