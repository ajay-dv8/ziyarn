import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { ProfileForm } from "@/components/dashboard/profile-form";
import { PasswordForm } from "@/components/dashboard/password-form";
import { CancelSubscriptionButton } from "@/components/dashboard/cancel-subscription-button";
import { DefaultCurrencyForm } from "@/components/dashboard/default-currency-form";
import { DeleteAccountDialog } from "@/components/dashboard/delete-account-dialog";
import { ManageSubscriptionButton } from "@/components/dashboard/manage-subscription-button";
import { ThemeSettings } from "@/components/dashboard/theme-settings";
import { AiProviderForm } from "@/components/settings/ai-provider-form";
import { APP_ROUTES } from "@/constants/routes";
import { aiConfigService } from "@/services/ai-config-service";
import { authService } from "@/services/auth-service";
import { billingService } from "@/services/billing-service";
import { settingsService } from "@/services/settings-service";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    redirect(APP_ROUTES.SIGN_IN);
  }

  const settings = await settingsService.getSettings(requestHeaders);
  const aiConfig = await aiConfigService.getWorkspaceConfig(requestHeaders);
  const subscription = await billingService.getSubscription(session.user.id);
  const subscriptionNeedsAction =
    subscription !== null &&
    ["active", "trialing", "past_due"].includes(subscription.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and workspace preferences.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your display name and email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            name={settings.user.name}
            email={settings.user.email}
          />
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change your account password. If you signed in with Google or
            LinkedIn, you won&apos;t have a password to change yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            Default currency for new products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DefaultCurrencyForm
            defaultCurrency={settings.defaultCurrency}
          />
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>
            Bring your own OpenAI-compatible provider instead of the platform
            model for this workspace. Keys are encrypted, shared with its
            members, and never shown in full.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiProviderForm mode="workspace" current={aiConfig} />
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose light or dark, or follow your system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSettings />
        </CardContent>
      </Card>

      {subscription && subscriptionNeedsAction ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Your subscription follows your account and sets the plan for every
              workspace you own. Cancel it before deleting your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscription.customerSubscriptionCode ? (
              <CancelSubscriptionButton />
            ) : subscription.stripeCustomerId ? (
              <ManageSubscriptionButton />
            ) : (
              <p className="text-sm text-muted-foreground">
                Contact support to cancel this subscription.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="max-w-lg border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently remove your sign-in and personal settings. Workspaces
            you own must be transferred first, and an active subscription must
            be canceled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}
