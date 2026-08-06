import { createEmailService } from "@repo/api/email";

import { db } from "@repo/database";

export const emailService = createEmailService({ db });
