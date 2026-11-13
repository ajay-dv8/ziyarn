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
import {
  MapsLinkError,
  resolveGoogleMapsLink,
} from "@repo/api/domains/maps-link";

import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";

export type ActionResult =
  | { ok: true; domainId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export type MapsLinkResult =
  | {
      ok: true;
      latitude: number | null;
      longitude: number | null;
      placeId: string | null;
      mapsUrl: string;
    }
  | { ok: false; error: string };

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
    const domain = await domainsService.createDomain(parsed.data, await headers());
    if (!domain) {
      return { ok: false, error: "Could not create the domain" };
    }
    revalidatePath(APP_ROUTES.DASHBOARD_DOMAINS);
    return { ok: true, domainId: domain.id };
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
    revalidatePath(APP_ROUTES.DASHBOARD_DOMAINS);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteDomainAction(id: string): Promise<ActionResult> {
  try {
    await domainsService.deleteDomain(id, await headers());
    revalidatePath(APP_ROUTES.DASHBOARD_DOMAINS);
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * Reads a pasted Google Maps link. Short share links need a server fetch to
 * reveal their coordinates; the Maps allowlist in the shared helper keeps that
 * fetch from becoming an open URL proxy.
 */
export async function parseMapsLinkAction(
  mapsUrl: string,
): Promise<MapsLinkResult> {
  const session = await authService.getSession(await headers());
  if (!session) {
    return { ok: false, error: "Sign in to add a location" };
  }

  try {
    const parsed = await resolveGoogleMapsLink(mapsUrl);
    return { ok: true, ...parsed };
  } catch (error) {
    if (error instanceof MapsLinkError) {
      return { ok: false, error: error.message };
    }
    console.error("Unexpected maps link error:", error);
    return {
      ok: false,
      error: "Could not read that link. Paste the full Google Maps URL.",
    };
  }
}
