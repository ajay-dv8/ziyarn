export { createDomainsService, DomainServiceError } from "@repo/api/domains/server";

export type { DomainsService, SessionWithUser } from "@repo/api/domains/server";

export {
  createDomainSchema,
  domainIdSchema,
  domainNameSchema,
  domainSlugSchema,
  updateDomainSchema,
  chatTriggerEnum,
  widgetVariantEnum,
} from "@repo/api/domains/schemas";

export type {
  CreateDomainInput,
  DomainIdInput,
  UpdateDomainInput,
} from "@repo/api/domains/schemas";

export {
  BUSINESS_TYPES,
  GENERIC_CONFIG,
  getBusinessTypeConfig,
  type BusinessType,
  type BusinessTypeConfig,
  type PageLabels,
} from "@repo/api/domains/business-types";

export {
  DEFAULT_WIDGET_VARIANT,
  WIDGET_VARIANTS,
  WIDGET_VARIANT_IDS,
  isWidgetVariant,
  resolveWidgetVariant,
  widgetVariantLabel,
  type WidgetVariantId,
} from "@repo/api/domains/widget-variants";

export {
  CHAT_TRIGGERS,
  CHAT_TRIGGER_IDS,
  DEFAULT_CHAT_TRIGGER,
  CHAT_TRIGGER_TOOLTIP_DEFAULT,
  chatTriggerLabel,
  isChatTrigger,
  resolveChatTrigger,
  resolveChatTriggerConfig,
  TOOLTIP_VISIBILITY_DEFAULT,
  type ChatTriggerId,
  type ChatTriggerConfig,
  type ResolvedChatTriggerConfig,
  type TooltipVisibility,
} from "@repo/api/domains/chat-triggers";
