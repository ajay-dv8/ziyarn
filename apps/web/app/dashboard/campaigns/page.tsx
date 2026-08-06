import type { Metadata } from "next";
import { headers } from "next/headers";

import { getPlanLimits, type Plan } from "@repo/api/plans";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { CreateCampaignButton } from "@/components/dashboard/create-campaign-button";
import { ScheduleCampaignControl } from "@/components/dashboard/schedule-campaign-button";
import { SendCampaignButton } from "@/components/dashboard/send-campaign-button";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { emailService } from "@/services/email-service";

export const metadata: Metadata = {
  title: "Campaigns",
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
};

export default async function CampaignsPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }
  const [campaigns, domains, emailsThisMonth] = await Promise.all([
    emailService.listCampaigns(session.user.id),
    domainsService.listDomains(requestHeaders),
    emailService.emailsSentThisMonth(session.user.id),
  ]);
  const plan = domains.reduce<Plan>(
    (best, domain) => (PLAN_RANK[domain.plan] > PLAN_RANK[best] ? domain.plan : best),
    "free",
  );
  const { emailsPerMonth } = getPlanLimits(plan);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Send marketing emails to the leads your agents capture.
          </p>
        </div>
        <CreateCampaignButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly email budget</CardTitle>
          <CardDescription>
            {emailsThisMonth} of {emailsPerMonth} emails sent this month (
            {plan} plan)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${Math.min(100, Math.round((emailsThisMonth / Math.max(1, emailsPerMonth)) * 100))}%`,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No campaigns yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first campaign to reach the leads you have collected.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{campaign.name}</CardTitle>
                  <Badge variant="secondary" className="capitalize">
                    {campaign.status}
                  </Badge>
                </div>
                <CardDescription>
                  {campaign.subject} ·{" "}
                  {new Date(campaign.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-secondary px-2 py-1">
                    {campaign.sentCount} sent
                  </span>
                  <span className="rounded-md bg-secondary px-2 py-1">
                    {campaign.deliveredCount} delivered
                  </span>
                  <span className="rounded-md bg-secondary px-2 py-1">
                    {campaign.failedCount} failed
                  </span>
                  <span className="rounded-md bg-secondary px-2 py-1">
                    {campaign.unsubscribedCount} unsubscribed
                  </span>
                </div>
                {campaign.status === "draft" ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <SendCampaignButton campaignId={campaign.id} />
                    <ScheduleCampaignControl
                      campaignId={campaign.id}
                      status={campaign.status}
                      scheduledAt={campaign.scheduledAt}
                    />
                  </div>
                ) : campaign.status === "scheduled" ? (
                  <div className="border-t border-border pt-3">
                    <ScheduleCampaignControl
                      campaignId={campaign.id}
                      status={campaign.status}
                      scheduledAt={campaign.scheduledAt}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
