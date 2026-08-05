import { createPortalService } from "@repo/api/portal";

import { db } from "@repo/database";

export const portalService = createPortalService({ db });
