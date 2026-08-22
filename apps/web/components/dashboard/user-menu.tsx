"use client";

import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { authClientService } from "@/components/auth/auth-client";
import { APP_ROUTES } from "@/constants/routes";

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.slice(0, 2).toUpperCase() || "U";
}

export function UserMenu({ email }: { email: string }) {
  const router = useRouter();

  const onLogout = async () => {
    const { error } = await authClientService.signOut();
    if (error) return;
    router.push(APP_ROUTES.SIGN_IN);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full p-0"
            aria-label="Open account menu"
          />
        }
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initialsOf(email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-foreground">Signed in as</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
