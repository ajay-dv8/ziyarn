import { sendTransactional } from "@repo/api/email";
import { createPortalService } from "@repo/api/portal";

import { db } from "@repo/database";

export const portalService = createPortalService({ db, sendTransactional });
