export {
  confirmBookingSchema,
  createBookingSchema,
  createPaymentRequestSchema,
  updateBookingStatusSchema,
  listBookingsSchema,
  bookingSettingsSchema,
  portalTokenSchema,
} from "@repo/api/portal/schemas";

export type {
  CreateBookingInput,
  CreatePaymentRequestInput,
  UpdateBookingStatusInput,
  BookingSettingsInput,
  PortalTokenPayload,
} from "@repo/api/portal/schemas";

export {
  createPortalService,
  PortalServiceError,
} from "@repo/api/portal/server";

export type { PortalService } from "@repo/api/portal/server";

export {
  checkSlotAvailable,
  getAvailableSlots,
  getBookingSettings,
} from "@repo/api/portal/availability";

export type { AvailabilityError } from "@repo/api/portal/availability";
