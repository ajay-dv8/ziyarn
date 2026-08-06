import { createBillingService } from "@repo/api/billing";

import { db } from "@repo/database";

export const billingService = createBillingService({ db });
