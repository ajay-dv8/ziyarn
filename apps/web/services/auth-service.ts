import { createAuthService } from "@repo/api/auth";

import { auth } from "../lib/auth";

export const authService = createAuthService(auth);
