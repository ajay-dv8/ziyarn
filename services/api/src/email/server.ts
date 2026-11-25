import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { getPlanLimits } from "@repo/api/plans";
import type { Plan } from "@repo/api/plans/schemas";
import { resolveWorkspacePlan } from "@repo/api/workspaces/plan";
import type { Database } from "@repo/database";
import {
  campaignRecipients,
  campaigns,
  customers,
  domains,
  unsubscribedEmails,
  type Campaign,
  type CampaignRecipient,
} from "@repo/database/schema";

import { createCampaignSchema, scheduleCampaignSchema } from "@repo/api/email/schemas";
import type {
  CreateCampaignInput,
  ScheduleCampaignInput,
} from "@repo/api/email/schemas";
import { renderEmailBody } from "@repo/api/email/blocks";
import { APP_ROUTES, absoluteUrl } from "@repo/routes";

export class EmailServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "EmailServiceError";
  }
}

function emailNotConfiguredError() {
  return new EmailServiceError(
    501,
    "EMAIL_NOT_CONFIGURED",
    "Email marketing is not configured for this deployment",
  );
}

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) {
    return null;
  }
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from,
  };
}

function createTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
}

function parseDomainUrl(): string {
  return (
    process.env.BASE_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

const UNSUBSCRIBE_FOOTER = (url: string) =>
  `<br/><br/><p style="font-size:12px;color:#71717a">You are receiving this because a business you interacted with is keeping in touch. <a href="${url}">Unsubscribe</a></p>`;

/**
 * A cron tick handles a bounded slice of due campaigns. The endpoint runs on a
 * serverless host, and sending is serial; a cap keeps one tick from timing out
 * and starving the rest of the queue.
 */
const MAX_CAMPAIGNS_PER_RUN = 10;

/** Failed campaigns wait one cron cycle plus a little room before retrying. */
const FAILED_CAMPAIGN_RETRY_MS = 15 * 60 * 1000;

type ResendWebhookPayload = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
  };
};

export type SendTransactionalInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendTransactional = (
  input: SendTransactionalInput,
) => Promise<{ ok: boolean }>;

/** Best-effort transactional send. Returns ok:false when SMTP is unset or the
 * send fails — callers must not fail their flow on email delivery. */
export async function sendTransactional(
  input: SendTransactionalInput,
): Promise<{ ok: boolean }> {
  const config = smtpConfig();
  if (!config) {
    return { ok: false };
  }
  try {
    const transport = createTransport(config);
    const info = await transport.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: Boolean(info.messageId) };
  } catch {
    return { ok: false };
  }
}

async function sendOne(
  transport: Transporter,
  fromEmail: string,
  campaign: Campaign,
  recipient: CampaignRecipient,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const url = `${absoluteUrl(parseDomainUrl(), APP_ROUTES.UNSUBSCRIBE)}?t=${encodeURIComponent(recipient.unsubscribeToken)}`;
  const html = `${campaign.body}${UNSUBSCRIBE_FOOTER(url)}`;
  const text = `${campaign.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n\nUnsubscribe: ${url}`;
  try {
    const info = await transport.sendMail({
      from: fromEmail,
      to: recipient.email,
      subject: campaign.subject,
      text,
      html,
    });
    if (!info.messageId) {
      return { ok: false };
    }
    return { ok: true, id: info.messageId };
  } catch {
    return { ok: false };
  }
}

export function createEmailService(deps: { db: Database }) {
  const { db } = deps;

  return {
    async createCampaign(
      ownerId: string,
      workspaceId: string,
      input: CreateCampaignInput,
    ): Promise<Campaign> {
      const data = createCampaignSchema.parse(input);
      const body = data.blocks ? renderEmailBody(data.blocks) : (data.body ?? "");
      const [campaign] = await db
        .insert(campaigns)
        .values({
          workspaceId,
          ownerId,
          name: data.name,
          subject: data.subject,
          body,
          audience: data.audience,
        })
        .returning();
      if (!campaign) {
        throw new EmailServiceError(500, "CREATE_FAILED", "Failed to create campaign");
      }
      return campaign;
    },

    async listCampaigns(workspaceId: string): Promise<Campaign[]> {
      return db
        .select()
        .from(campaigns)
        .where(eq(campaigns.workspaceId, workspaceId))
        .orderBy(desc(campaigns.createdAt));
    },

    async getCampaign(
      workspaceId: string,
      campaignId: string,
    ): Promise<Campaign> {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.id, campaignId),
            eq(campaigns.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!campaign) {
        throw new EmailServiceError(404, "NOT_FOUND", "Campaign not found");
      }
      return campaign;
    },

    /**
     * Schedules a draft campaign for delivery at a future time. The send
     * itself is triggered by the scheduler (processDueCampaigns).
     */
    async scheduleCampaign(
      workspaceId: string,
      campaignId: string,
      input: ScheduleCampaignInput,
    ): Promise<Campaign> {
      const data = scheduleCampaignSchema.parse(input);
      const when = new Date(data.scheduledAt);
      if (Number.isNaN(when.getTime())) {
        throw new EmailServiceError(400, "INVALID_DATE", "Scheduled time is invalid");
      }
      if (when.getTime() <= Date.now()) {
        throw new EmailServiceError(400, "SCHEDULE_IN_PAST", "Scheduled time must be in the future");
      }
      const campaign = await this.getCampaign(workspaceId, campaignId);
      if (campaign.status !== "draft") {
        throw new EmailServiceError(
          409,
          "CAMPAIGN_NOT_DRAFT",
          "Only draft campaigns can be scheduled",
        );
      }
      const [updated] = await db
        .update(campaigns)
        .set({ status: "scheduled", scheduledAt: when, updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id))
        .returning();
      if (!updated) {
        throw new EmailServiceError(500, "UPDATE_FAILED", "Failed to schedule campaign");
      }
      return updated;
    },

    /** Cancels a scheduled campaign, returning it to draft. */
    async cancelScheduledCampaign(
      workspaceId: string,
      campaignId: string,
    ): Promise<Campaign> {
      const campaign = await this.getCampaign(workspaceId, campaignId);
      if (campaign.status !== "scheduled") {
        throw new EmailServiceError(
          409,
          "CAMPAIGN_NOT_SCHEDULED",
          "This campaign is not scheduled",
        );
      }
      const [updated] = await db
        .update(campaigns)
        .set({ status: "draft", scheduledAt: null, updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id))
        .returning();
      if (!updated) {
        throw new EmailServiceError(500, "UPDATE_FAILED", "Failed to cancel campaign");
      }
      return updated;
    },

    /**
     * Sends every campaign whose scheduled time has arrived. Called by the
     * scheduler endpoint (cron).
     *
     * Each campaign is claimed with a conditional update before any mail is
     * built, so two overlapping cron runs cannot both send it. A campaign that
     * fails is put back on the queue with a cool-down instead of being left
     * stuck in `sending`.
     */
    async processDueCampaigns(): Promise<{
      sent: number;
      failed: number;
      skipped: number;
    }> {
      if (!smtpConfig()) {
        throw emailNotConfiguredError();
      }

      const now = new Date();
      const due = await db
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.status, "scheduled"),
            lte(campaigns.scheduledAt, now),
          ),
        )
        .orderBy(asc(campaigns.scheduledAt))
        .limit(MAX_CAMPAIGNS_PER_RUN);

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const candidate of due) {
        const [claimed] = await db
          .update(campaigns)
          .set({ status: "sending", updatedAt: new Date() })
          .where(
            and(
              eq(campaigns.id, candidate.id),
              eq(campaigns.status, "scheduled"),
              lte(campaigns.scheduledAt, now),
            ),
          )
          .returning();

        if (!claimed) {
          skipped += 1;
          continue;
        }

        try {
          await this.deliverClaimedCampaign(claimed);
          sent += 1;
        } catch (error) {
          failed += 1;
          console.error(
            `Campaign ${claimed.id} failed; retrying in 15 minutes:`,
            error instanceof Error ? error.message : error,
          );
          try {
            await db
              .update(campaigns)
              .set({
                status: "scheduled",
                scheduledAt: new Date(Date.now() + FAILED_CAMPAIGN_RETRY_MS),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(campaigns.id, claimed.id),
                  eq(campaigns.status, "sending"),
                ),
              );
          } catch (releaseError) {
            console.error(
              `Campaign ${claimed.id} could not be rescheduled:`,
              releaseError instanceof Error
                ? releaseError.message
                : releaseError,
            );
          }
        }
      }

      return { sent, failed, skipped };
    },

    async getRecipients(
      workspaceId: string,
      campaignId: string,
    ): Promise<CampaignRecipient[]> {
      await this.getCampaign(workspaceId, campaignId);
      return db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId))
        .orderBy(desc(campaignRecipients.createdAt))
        .limit(500);
    },

    async countRecipients(
      workspaceId: string,
      campaignId: string,
    ): Promise<number> {
      await this.getCampaign(workspaceId, campaignId);
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId));
      return row?.count ?? 0;
    },

    /**
     * Sends a campaign immediately on behalf of its owner. The campaign is
     * claimed atomically before delivery, so a double click cannot send twice.
     */
    async sendCampaign(
      workspaceId: string,
      campaignId: string,
    ): Promise<{ recipients: number }> {
      if (!smtpConfig()) {
        throw emailNotConfiguredError();
      }
      const campaign = await this.getCampaign(workspaceId, campaignId);
      if (campaign.status === "sent" || campaign.status === "sending") {
        throw new EmailServiceError(
          409,
          "CAMPAIGN_ALREADY_SENT",
          "This campaign has already been sent",
        );
      }

      // The read above is only for ownership and an early, useful error. The
      // conditional update is the real lock: only one caller can move the
      // campaign out of draft/scheduled.
      const [claimed] = await db
        .update(campaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(
          and(
            eq(campaigns.id, campaign.id),
            eq(campaigns.workspaceId, workspaceId),
            inArray(campaigns.status, ["draft", "scheduled"]),
          ),
        )
        .returning();

      if (!claimed) {
        throw new EmailServiceError(
          409,
          "CAMPAIGN_ALREADY_SENT",
          "This campaign is already being sent or has been sent",
        );
      }

      try {
        return await this.deliverClaimedCampaign(claimed);
      } catch (error) {
        const previousStatus =
          campaign.status === "scheduled" ? "scheduled" : "draft";
        try {
          await db
            .update(campaigns)
            .set({
              status: previousStatus,
              scheduledAt:
                previousStatus === "scheduled" ? campaign.scheduledAt : null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(campaigns.id, claimed.id),
                eq(campaigns.status, "sending"),
              ),
            );
        } catch (releaseError) {
          console.error(
            `Campaign ${claimed.id} could not be released after a failed manual send:`,
            releaseError instanceof Error
              ? releaseError.message
              : releaseError,
          );
        }
        throw error;
      }
    },

    /**
     * Delivers a campaign already claimed as `sending`. Preflight failures
     * bubble up so the caller can release the claim; individual SMTP failures
     * are counted per recipient and do not abort the rest of the audience.
     */
    async deliverClaimedCampaign(
      campaign: Campaign,
    ): Promise<{ recipients: number }> {
      const config = smtpConfig();
      if (!config) {
        throw emailNotConfiguredError();
      }
      const recipients = await this.buildRecipientList(
        campaign.workspaceId,
        campaign.audience,
      );
      if (recipients.length === 0) {
        await db
          .update(campaigns)
          .set({ status: "sent", sentCount: 0, updatedAt: new Date() })
          .where(eq(campaigns.id, campaign.id));
        return { recipients: 0 };
      }

      const emailsThisMonth = await this.emailsSentThisMonth(
        campaign.workspaceId,
      );
      const plan = await this.workspacePlan(campaign.workspaceId);
      const { emailsPerMonth } = getPlanLimits(plan);
      if (emailsThisMonth + recipients.length > emailsPerMonth) {
        throw new EmailServiceError(
          429,
          "EMAIL_CREDIT_EXCEEDED",
          `Your ${plan} plan allows ${emailsPerMonth} emails per month and you have ${emailsThisMonth} remaining`,
        );
      }

      const inserted = await db
        .insert(campaignRecipients)
        .values(
          recipients.map((recipient) => ({
            campaignId: campaign.id,
            // `campaign_recipients.lead_id` still references the retired
            // `leads` table. Customers are email-keyed now, so leave that
            // legacy link null instead of writing a customer id into it.
            email: recipient.email,
            unsubscribeToken: randomBytes(24).toString("base64url"),
          })),
        )
        .returning();

      const transport = createTransport(config);

      let sent = 0;
      let failed = 0;
      for (const recipient of inserted) {
        const result = await sendOne(
          transport,
          config.from,
          campaign,
          recipient,
        );
        if (result.ok) {
          sent += 1;
          await db
            .update(campaignRecipients)
            .set({
              status: "sent",
              resendEmailId: result.id,
              updatedAt: new Date(),
            })
            .where(eq(campaignRecipients.id, recipient.id));
        } else {
          failed += 1;
          await db
            .update(campaignRecipients)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(campaignRecipients.id, recipient.id));
        }
      }

      await db
        .update(campaigns)
        .set({
          status: "sent",
          sentCount: sent,
          failedCount: failed,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaign.id));

      return { recipients: inserted.length };
    },

    /** Marks an email as unsubscribed and suppresses it in the campaign's workspace. */
    async unsubscribe(token: string): Promise<void> {
      const [recipient] = await db
        .select({
          id: campaignRecipients.id,
          email: campaignRecipients.email,
          campaignId: campaignRecipients.campaignId,
          workspaceId: campaigns.workspaceId,
          ownerId: campaigns.ownerId,
        })
        .from(campaignRecipients)
        .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
        .where(eq(campaignRecipients.unsubscribeToken, token))
        .limit(1);
      if (!recipient) {
        throw new EmailServiceError(404, "NOT_FOUND", "Unsubscribe link invalid");
      }

      // One statement because neon-http has no interactive transactions.
      // Repeating the link is safe: the recipient update and count increment
      // run only once, while the suppression insert is idempotent.
      await db.execute(sql`
        WITH updated AS (
          UPDATE ${campaignRecipients}
          SET "status" = 'unsubscribed', "updated_at" = now()
          WHERE "id" = ${recipient.id}
            AND "status" <> 'unsubscribed'
          RETURNING "campaign_id"
        ),
        campaign_count AS (
          UPDATE ${campaigns}
          SET "unsubscribed_count" = "unsubscribed_count" + 1,
              "updated_at" = now()
          WHERE "id" = (SELECT "campaign_id" FROM updated)
          RETURNING "id"
        ),
        suppression AS (
          INSERT INTO ${unsubscribedEmails} ("workspace_id", "owner_id", "email")
          VALUES (
            ${recipient.workspaceId},
            ${recipient.ownerId},
            ${recipient.email.trim().toLowerCase()}
          )
          ON CONFLICT ("workspace_id", "email") DO NOTHING
          RETURNING "id"
        )
        SELECT (SELECT count(*) FROM suppression)::int AS inserted
      `);
    },

    /**
     * Verifies a Resend webhook (Svix signing scheme) and applies
     * delivered/bounced/complained events to recipients.
     */
    async handleResendWebhook(rawBody: string, headers: Headers): Promise<{ handled: boolean }> {
      const secret = process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) {
        throw emailNotConfiguredError();
      }
      const svixId = headers.get("svix-id");
      const svixTimestamp = headers.get("svix-timestamp");
      const svixSignature = headers.get("svix-signature");
      if (!svixId || !svixTimestamp || !svixSignature) {
        throw new EmailServiceError(400, "WEBHOOK_HEADERS_MISSING", "Missing Svix headers");
      }
      const now = Math.floor(Date.now() / 1000);
      const ts = Number(svixTimestamp);
      if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
        throw new EmailServiceError(400, "WEBHOOK_TIMESTAMP_INVALID", "Webhook timestamp too old");
      }
      const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
      const expected = createHmac("sha256", secret)
        .update(signedContent)
        .digest("base64");
      const supplied = svixSignature
        .split(" ")
        .map((part) => part.split(",")[1])
        .filter((part): part is string => Boolean(part));
      const valid = supplied.some(
        (sig) =>
          sig.length === expected.length &&
          timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
      );
      if (!valid) {
        throw new EmailServiceError(400, "WEBHOOK_SIGNATURE_INVALID", "Invalid webhook signature");
      }

      let payload: ResendWebhookPayload;
      try {
        payload = JSON.parse(rawBody) as ResendWebhookPayload;
      } catch {
        throw new EmailServiceError(400, "WEBHOOK_INVALID", "Invalid webhook payload");
      }
      const emailId = payload.data?.email_id;
      if (!emailId) {
        return { handled: false };
      }
      const [recipient] = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.resendEmailId, emailId))
        .limit(1);
      if (!recipient) {
        return { handled: false };
      }
      const delivered = payload.type === "email.delivered";
      const failed = payload.type === "email.bounced" || payload.type === "email.complained";
      if (delivered || failed) {
        await db.transaction(async (tx) => {
          await tx
            .update(campaignRecipients)
            .set({
              status: delivered ? "delivered" : "failed",
              updatedAt: new Date(),
            })
            .where(eq(campaignRecipients.id, recipient.id));
          const col = delivered
            ? campaigns.deliveredCount
            : campaigns.failedCount;
          await tx
            .update(campaigns)
            .set({ [delivered ? "deliveredCount" : "failedCount"]: sql`${col} + 1`, updatedAt: new Date() })
            .where(eq(campaigns.id, recipient.campaignId));
        });
        return { handled: true };
      }
      return { handled: false };
    },

    async emailsSentThisMonth(workspaceId: string): Promise<number> {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [row] = await db
        .select({
          total: sql<number>`coalesce(sum(${campaigns.sentCount} + ${campaigns.failedCount}), 0)::int`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.workspaceId, workspaceId),
            eq(campaigns.status, "sent"),
            gte(campaigns.createdAt, startOfMonth),
          ),
        );
      return row?.total ?? 0;
    },

    /** The plan whose email allowance applies to this workspace. */
    async workspacePlan(workspaceId: string): Promise<Plan> {
      return resolveWorkspacePlan(db, workspaceId);
    },

    /**
     * Recipients for a campaign, drawn from the unified customers table.
     * `audience` filters by provenance: chat-captured, database-synced,
     * imported subscribers, or everyone. This workspace's unsubscribed
     * emails are removed.
     */
    async buildRecipientList(
      workspaceId: string,
      audience: "all" | "chat" | "database" | "site" = "all",
    ): Promise<Array<{ id: string; email: string }>> {
      const conditions = [eq(domains.workspaceId, workspaceId)];
      if (audience !== "all") {
        conditions.push(eq(customers.source, audience));
      }
      const rows = await db
        .select({
          id: customers.id,
          email: customers.email,
          emailLower: customers.emailLower,
        })
        .from(customers)
        .innerJoin(domains, eq(customers.domainId, domains.id))
        .where(and(...conditions));

      const byEmail = new Map<string, { id: string; email: string }>();
      for (const row of rows) {
        if (row.emailLower && !byEmail.has(row.emailLower)) {
          byEmail.set(row.emailLower, { id: row.id, email: row.email });
        }
      }
      if (byEmail.size === 0) {
        return [];
      }
      const suppressed = await db
        .select({ email: unsubscribedEmails.email })
        .from(unsubscribedEmails)
        .where(eq(unsubscribedEmails.workspaceId, workspaceId));
      const suppressedSet = new Set(suppressed.map((entry) => entry.email.toLowerCase()));
      return [...byEmail.values()].filter(
        (recipient) => !suppressedSet.has(recipient.email.toLowerCase()),
      );
    },
  };
}
