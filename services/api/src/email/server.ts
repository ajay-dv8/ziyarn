import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { getPlanLimits } from "@repo/api/plans";
import type { Plan } from "@repo/api/plans/schemas";
import type { Database } from "@repo/database";
import {
  agents,
  campaignRecipients,
  campaigns,
  conversations,
  domains,
  leads,
  subscriptions,
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
  const url = `${parseDomainUrl()}/unsubscribe?t=${encodeURIComponent(recipient.unsubscribeToken)}`;
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
    async createCampaign(ownerId: string, input: CreateCampaignInput): Promise<Campaign> {
      const data = createCampaignSchema.parse(input);
      const body = data.blocks ? renderEmailBody(data.blocks) : (data.body ?? "");
      const [campaign] = await db
        .insert(campaigns)
        .values({
          ownerId,
          name: data.name,
          subject: data.subject,
          body,
        })
        .returning();
      if (!campaign) {
        throw new EmailServiceError(500, "CREATE_FAILED", "Failed to create campaign");
      }
      return campaign;
    },

    async listCampaigns(ownerId: string): Promise<Campaign[]> {
      return db
        .select()
        .from(campaigns)
        .where(eq(campaigns.ownerId, ownerId))
        .orderBy(desc(campaigns.createdAt));
    },

    async getCampaign(ownerId: string, campaignId: string): Promise<Campaign> {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)))
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
      ownerId: string,
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
      const campaign = await this.getCampaign(ownerId, campaignId);
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
      ownerId: string,
      campaignId: string,
    ): Promise<Campaign> {
      const campaign = await this.getCampaign(ownerId, campaignId);
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
     * scheduler endpoint (cron). Sends happen serially so email credits stay
     * consistent; failures bubble up per campaign via sendCampaign.
     */
    async processDueCampaigns(): Promise<{ sent: number; failed: number }> {
      const now = new Date();
      const due = await db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.status, "scheduled"), lte(campaigns.scheduledAt, now)));
      let sent = 0;
      let failed = 0;
      for (const campaign of due) {
        try {
          await this.sendCampaign(campaign.ownerId, campaign.id);
          sent += 1;
        } catch {
          failed += 1;
        }
      }
      return { sent, failed };
    },

    async getRecipients(
      ownerId: string,
      campaignId: string,
    ): Promise<CampaignRecipient[]> {
      await this.getCampaign(ownerId, campaignId);
      return db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId))
        .orderBy(desc(campaignRecipients.createdAt))
        .limit(500);
    },

    async countRecipients(ownerId: string, campaignId: string): Promise<number> {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId));
      return row?.count ?? 0;
    },

    /**
     * Sends a campaign to all leads of the owner's domains. Enforces the
     * plan's monthly email budget, skips unsubscribed emails, and records
     * every recipient. Delivers via SMTP through Nodemailer. Gracefully
     * rejects when SMTP is not configured.
     */
    async sendCampaign(
      ownerId: string,
      campaignId: string,
    ): Promise<{ recipients: number }> {
      const config = smtpConfig();
      if (!config) {
        throw emailNotConfiguredError();
      }
      const campaign = await this.getCampaign(ownerId, campaignId);
      if (campaign.status === "sent" || campaign.status === "sending") {
        throw new EmailServiceError(
          409,
          "CAMPAIGN_ALREADY_SENT",
          "This campaign has already been sent",
        );
      }      const recipients = await this.buildRecipientList(ownerId);
      if (recipients.length === 0) {
        await db
          .update(campaigns)
          .set({ status: "sent", sentCount: 0, updatedAt: new Date() })
          .where(eq(campaigns.id, campaign.id));
        return { recipients: 0 };
      }

      const emailsThisMonth = await this.emailsSentThisMonth(ownerId);
      const plan = await this.ownerPlan(ownerId);
      const { emailsPerMonth } = getPlanLimits(plan);
      if (emailsThisMonth + recipients.length > emailsPerMonth) {
        throw new EmailServiceError(
          429,
          "EMAIL_CREDIT_EXCEEDED",
          `Your ${plan} plan allows ${emailsPerMonth} emails per month and you have ${emailsThisMonth} remaining`,
        );
      }

      await db
        .update(campaigns)
        .set({ status: "sending", updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));

      const inserted = await db
        .insert(campaignRecipients)
        .values(
          recipients.map((lead) => ({
            campaignId: campaign.id,
            leadId: lead.id,
            email: lead.email,
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
            .set({ status: "sent", resendEmailId: result.id, updatedAt: new Date() })
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

    /** Marks an email as unsubscribed and suppresses it for all future sends. */
    async unsubscribe(token: string): Promise<void> {
      const [recipient] = await db
        .select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.unsubscribeToken, token))
        .limit(1);
      if (!recipient) {
        throw new EmailServiceError(404, "NOT_FOUND", "Unsubscribe link invalid");
      }
      await db.transaction(async (tx) => {
        await tx
          .update(campaignRecipients)
          .set({ status: "unsubscribed", updatedAt: new Date() })
          .where(eq(campaignRecipients.id, recipient.id));
        const [campaign] = await tx
          .select({ ownerId: campaigns.ownerId })
          .from(campaigns)
          .where(eq(campaigns.id, recipient.campaignId))
          .limit(1);
        if (campaign) {
          await tx
            .update(campaigns)
            .set({
              unsubscribedCount: sql`${campaigns.unsubscribedCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(campaigns.id, recipient.campaignId));
        }
        await tx
          .insert(unsubscribedEmails)
          .values({
            ownerId: campaign?.ownerId ?? null,
            email: recipient.email.toLowerCase(),
          })
          .onConflictDoNothing();
      });
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

    async emailsSentThisMonth(ownerId: string): Promise<number> {
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
            eq(campaigns.ownerId, ownerId),
            eq(campaigns.status, "sent"),
            gte(campaigns.createdAt, startOfMonth),
          ),
        );
      return row?.total ?? 0;
    },

    async ownerPlan(ownerId: string): Promise<Plan> {
      const [sub] = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.ownerId, ownerId),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1);
      if (sub) {
        return sub.plan;
      }
      const [row] = await db
        .select({ plan: domains.plan })
        .from(domains)
        .where(eq(domains.ownerId, ownerId))
        .limit(1);
      return row?.plan ?? "free";
    },

    async buildRecipientList(ownerId: string): Promise<Array<{ id: string; email: string }>> {
      const rows = await db
        .select({ id: leads.id, email: leads.email })
        .from(leads)
        .innerJoin(conversations, eq(conversations.id, leads.conversationId))
        .innerJoin(agents, eq(agents.id, conversations.agentId))
        .innerJoin(domains, eq(domains.id, agents.domainId))
        .where(eq(domains.ownerId, ownerId));
      const byEmail = new Map<string, { id: string; email: string }>();
      for (const row of rows) {
        const email = row.email?.trim().toLowerCase();
        if (email && !byEmail.has(email)) {
          byEmail.set(email, { id: row.id, email: row.email! });
        }
      }
      if (byEmail.size === 0) {
        return [];
      }
      const suppressed = await db
        .select({ email: unsubscribedEmails.email })
        .from(unsubscribedEmails);
      const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));
      return [...byEmail.values()].filter(
        (r) => !suppressedSet.has(r.email.toLowerCase()),
      );
    },
  };
}
