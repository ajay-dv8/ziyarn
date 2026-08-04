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

import { SignUpForm } from "@/components/auth/sign-up-form";
import { authService } from "@/lib/auth-service";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignUpPage() {
  const session = await authService.getSession(await headers());
  if (session) {
    redirect("/");
  }

  const socialProviders = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    linkedin: Boolean(process.env.LINKEDIN_CLIENT_ID),
  };

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Join Ziyarn to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm socialProviders={socialProviders} />
        </CardContent>
      </Card>
    </main>
  );
}
