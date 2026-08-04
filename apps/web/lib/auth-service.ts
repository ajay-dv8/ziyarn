import { createAuthService } from "@repo/api/auth";

import { auth } from "./auth";

export const authService = createAuthService(auth);
