"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { toast } from "sonner";

import { APP_ROUTES } from "@/constants/routes";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleAccept = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to accept invite");
        setPending(false);
        return;
      }

      toast.success("Invite accepted! Welcome to the workspace.");
      router.push(APP_ROUTES.DASHBOARD);
      router.refresh();
    } catch {
      toast.error("Failed to accept invite");
      setPending(false);
    }
  };

  return (
    <Button onClick={handleAccept} disabled={pending} className="w-full">
      {pending ? "Joining..." : "Accept invite"}
    </Button>
  );
}
