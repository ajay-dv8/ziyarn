"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { AiConfigServiceError, type UpdateAiConfigInput } from "@repo/api/ai";

import { APP_ROUTES } from "@/constants/routes";
import { aiConfigService } from "@/services/ai-config-service";

export type AiActionResult =
  | { ok: true }
  | { ok: false; error: string };

function errorResult(error: unknown): Extract<AiActionResult, { ok: false }> {
  if (error instanceof AiConfigServiceError) {
    return { ok: false, error: error.message };
  }
  console.error("Unexpected AI config error:", error);
  return { ok: false, error: "Something went wrong, please try again" };
}

/** Saves the account-level provider, or the domain override when domainId is set. */
export async function saveAiConfigAction(
  input: UpdateAiConfigInput & { domainId?: string },
): Promise<AiActionResult> {
  try {
    const requestHeaders = await headers();
    const { domainId, ...config } = input;

    if (domainId) {
      await aiConfigService.updateDomainOverride(
        config,
        domainId,
        requestHeaders,
      );
    } else {
      await aiConfigService.updateAccountConfig(config, requestHeaders);
    }

    revalidatePath(APP_ROUTES.DASHBOARD_SETTINGS);
    revalidatePath(APP_ROUTES.DASHBOARD_DOMAINS);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Deletes a domain override, reverting the domain to the account default. */
export async function clearDomainAiOverrideAction(
  domainId: string,
): Promise<AiActionResult> {
  try {
    await aiConfigService.deleteDomainOverride(domainId, await headers());
    revalidatePath(APP_ROUTES.DASHBOARD_DOMAINS);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Sends one tiny request with the saved configuration. */
export async function testAiConnectionAction(
  domainId?: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    return await aiConfigService.testConnection(await headers(), domainId);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof AiConfigServiceError
          ? error.message
          : "Something went wrong, please try again",
    };
  }
}
