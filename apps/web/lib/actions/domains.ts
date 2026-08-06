"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  createDomainSchema,
  updateDomainSchema,
  type CreateDomainInput,
  type UpdateDomainInput,
} from "@repo/api/domains";
import { DomainServiceError, PlanLimitError } from "@repo/api";

import { domainsService } from "@/services/domains-service";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

function errorResult(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof DomainServiceError || error instanceof PlanLimitError) {
    return { ok: false, error: error.message };
  }
  console.error("Unexpected server action error:", error);
  return { ok: false, error: "Something went wrong, please try again" };
}

export async function createDomainAction(
  input: CreateDomainInput,
): Promise<ActionResult> {
  const parsed = createDomainSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await domainsService.createDomain(parsed.data, await headers());
    revalidatePath("/dashboard/domains");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateDomainAction(
  id: string,
  input: UpdateDomainInput,
): Promise<ActionResult> {
  const parsed = updateDomainSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await domainsService.updateDomain(id, parsed.data, await headers());
    revalidatePath("/dashboard/domains");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteDomainAction(id: string): Promise<ActionResult> {
  try {
    await domainsService.deleteDomain(id, await headers());
    revalidatePath("/dashboard/domains");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}
