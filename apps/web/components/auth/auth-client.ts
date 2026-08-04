import { createAuthClientService } from "@repo/api/auth";

import { authClient } from "../../lib/auth-client";

export const authClientService = createAuthClientService(authClient);
