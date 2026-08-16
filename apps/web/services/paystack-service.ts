import { createPaystackService } from "@repo/api/paystack";

import { db } from "@repo/database";

import { billingService } from "@/services/billing-service";

export const paystackService = createPaystackService({ db, billing: billingService });