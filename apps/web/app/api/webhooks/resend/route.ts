import { NextResponse } from "next/server";

import { EmailServiceError } from "@repo/api/email";

import { emailService } from "@/services/email-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const { handled } = await emailService.handleResendWebhook(rawBody, request.headers);
    return NextResponse.json({ received: true, handled });
  } catch (error) {
    if (error instanceof EmailServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/webhooks/resend failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
