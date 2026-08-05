import { redirect } from "next/navigation";

import { APP_ROUTES } from "@/constants/routes";

export default function DashboardPage() {
  redirect(APP_ROUTES.DASHBOARD_DOMAINS);
}
