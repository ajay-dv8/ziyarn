"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";

import { authClientService } from "./auth-client";
import { APP_ROUTES } from "@/constants/routes";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onLogout = async () => {
    setPending(true);
    const { error } = await authClientService.signOut();
    if (error) {
      setPending(false);
      return;
    }
    router.push(APP_ROUTES.SIGN_IN);
    router.refresh();
  };

  return (
    <Button variant="outline" onClick={onLogout} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
