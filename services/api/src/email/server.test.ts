import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Campaign } from "@repo/database/schema";

import { createEmailService } from "@repo/api/email";

const DUE_CAMPAIGN = {
  id: "campaign-1",
  ownerId: "owner-1",
  name: "Autumn update",
  subject: "Hello",
  body: "A short update.",
  status: "scheduled",
  audience: "all",
  scheduledAt: new Date("2026-10-21T00:00:00.000Z"),
  sentCount: 0,
  deliveredCount: 0,
  failedCount: 0,
  unsubscribedCount: 0,
  createdAt: new Date("2026-10-20T00:00:00.000Z"),
  updatedAt: new Date("2026-10-20T00:00:00.000Z"),
} as Campaign;

type FakeDbOptions = {
  due: Campaign[];
  claim: Campaign[];
  onReschedule?: (values: Record<string, unknown>) => void;
};

function createFakeDb({ due, claim, onReschedule }: FakeDbOptions) {
  let updateCount = 0;

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => due,
          }),
        }),
      }),
    }),
    update: () => {
      updateCount += 1;
      const isClaim = updateCount === 1;
      return {
        set: (values: Record<string, unknown>) => ({
          where: () => {
            if (!isClaim) {
              onReschedule?.(values);
              return Promise.resolve([]);
            }
            return {
              returning: async () => claim,
            };
          },
        }),
      };
    },
  };
}

function createService(fakeDb: ReturnType<typeof createFakeDb>) {
  return createEmailService({ db: fakeDb as never });
}

describe("processDueCampaigns", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_FROM", "Ziyarn <no-reply@example.com>");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("claims a due campaign and delivers it once", async () => {
    const fakeDb = createFakeDb({ due: [DUE_CAMPAIGN], claim: [DUE_CAMPAIGN] });
    const service = createService(fakeDb);
    let delivered = 0;
    service.deliverClaimedCampaign = async () => {
      delivered += 1;
      return { recipients: 3 };
    };

    const result = await service.processDueCampaigns();

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(delivered).toBe(1);
  });

  it("skips a campaign another run already claimed", async () => {
    const fakeDb = createFakeDb({ due: [DUE_CAMPAIGN], claim: [] });
    const service = createService(fakeDb);
    let delivered = 0;
    service.deliverClaimedCampaign = async () => {
      delivered += 1;
      return { recipients: 1 };
    };

    const result = await service.processDueCampaigns();

    expect(result).toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(delivered).toBe(0);
  });

  it("reschedules a failed campaign instead of leaving it in sending", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let rescheduled: Record<string, unknown> | undefined;
    const fakeDb = createFakeDb({
      due: [DUE_CAMPAIGN],
      claim: [DUE_CAMPAIGN],
      onReschedule: (values) => {
        rescheduled = values;
      },
    });
    const service = createService(fakeDb);
    service.deliverClaimedCampaign = async () => {
      throw new Error("SMTP unavailable");
    };

    const result = await service.processDueCampaigns();

    expect(result).toEqual({ sent: 0, failed: 1, skipped: 0 });
    expect(rescheduled?.status).toBe("scheduled");
    expect(rescheduled?.scheduledAt).toBeInstanceOf(Date);
    expect(
      (rescheduled?.scheduledAt as Date).getTime(),
    ).toBeGreaterThan(Date.now() + 10 * 60 * 1000);
  });

  it("fails fast when SMTP is not configured", async () => {
    vi.unstubAllEnvs();
    const fakeDb = createFakeDb({ due: [DUE_CAMPAIGN], claim: [DUE_CAMPAIGN] });
    const service = createService(fakeDb);

    await expect(service.processDueCampaigns()).rejects.toMatchObject({
      code: "EMAIL_NOT_CONFIGURED",
    });
  });
});
