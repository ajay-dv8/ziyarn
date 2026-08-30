import { headers } from "next/headers";

import { listPaymentsSchema } from "@repo/api/portal";
import { portalService } from "@/services/portal-service";
import { authService } from "@/services/auth-service";

export const ordersService = {
  async list(
    input: {
      domainId: string;
      source?: "chat" | "db";
      q?: string;
      limit?: number;
      offset?: number;
    },
    requestHeaders?: Headers,
  ) {
    const hdrs = requestHeaders ?? (await headers());
    const session = await authService.getSession(hdrs);
    if (!session?.user) {
      return {
        orders: [],
        counts: { all: 0, chat: 0, db: 0 },
      };
    }

    const parsed = listPaymentsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        orders: [],
        counts: { all: 0, chat: 0, db: 0 },
      };
    }

    return portalService.listPayments(parsed.data.domainId, {
      source: parsed.data.source,
      q: parsed.data.q,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  },
};
