import type { Metadata } from "next";

import { EmailServiceError } from "@repo/api/email";

import { emailService } from "@/services/email-service";

export const metadata: Metadata = {
  title: "Unsubscribed",
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;

  if (token) {
    try {
      await emailService.unsubscribe(token);
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
              You are unsubscribed
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              You will no longer receive email campaigns from this business.
            </p>
          </div>
        </div>
      );
    } catch (error) {
      if (error instanceof EmailServiceError && error.code === "NOT_FOUND") {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Invalid link
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                This unsubscribe link is not valid or has already been used.
              </p>
            </div>
          </div>
        );
      }
      throw error;
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Missing link
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Please open the unsubscribe link from the email you received.
        </p>
      </div>
    </div>
  );
}
