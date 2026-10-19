import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

import { APP_ROUTES } from "@/constants/routes";

export const source = loader({
  baseUrl: APP_ROUTES.DOCS,
  source: docs.toFumadocsSource(),
});
