export {
  NOTIFICATION_RETENTION_DAYS,
  NotificationServiceError,
  buildEscalationNotification,
  createNotificationsService,
  ensureConversationEscalationNotification,
  markConversationNotificationsRead,
  notifyConversationEscalated,
  pruneExpiredNotifications,
} from "@repo/api/notifications/server";

export type {
  ConversationEscalatedNotificationInput,
  NotificationListRow,
  NotificationReadTarget,
  NotificationSummary,
} from "@repo/api/notifications/server";
