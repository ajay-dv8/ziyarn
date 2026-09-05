export { createDomainsService, DomainServiceError } from "@repo/api/domains/server";

export type { DomainsService, SessionWithUser } from "@repo/api/domains/server";

export {
  createDomainSchema,
  domainIdSchema,
  domainNameSchema,
  domainSlugSchema,
  updateDomainSchema,
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
