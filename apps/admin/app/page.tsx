import { redirect } from "next/navigation";

import { isAdminSetupAvailable } from "@/lib/admin-setup";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // First run: the panel ships with sign-in only, so send the operator to the
  // one-time bootstrap instead of a sign-in form they cannot get past.
  if (await isAdminSetupAvailable()) {
    redirect("/setup");
  }
  redirect("/admin");
}
