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
import { DefaultCurrencyForm } from "@/components/dashboard/default-currency-form";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
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
    </div>
  );
}
