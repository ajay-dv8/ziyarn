export {
  createSettingsService,
  SettingsServiceError,
} from "@repo/api/settings/server";

export type { SettingsService } from "@repo/api/settings/server";

export {
  changePasswordSchema,
  updateDefaultCurrencySchema,
  updateProfileSchema,
} from "@repo/api/settings/schemas";

export type {
  ChangePasswordInput,
  UpdateDefaultCurrencyInput,
  UpdateProfileInput,
} from "@repo/api/settings/schemas";
