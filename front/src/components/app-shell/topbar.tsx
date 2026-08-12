import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";
import type { User } from "@/types/api";

export function Topbar({ user }: { user: User }) {
  return (
    <header
      data-app-shell="topbar"
      className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-8 gap-4"
    >
      <div className="md:hidden font-bold tracking-tight flex items-center gap-2">
        <img src="/yordamchim.svg" alt="Yordamchim Logo" className="w-7 h-7" />
        Yordamchim
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <div className="text-sm text-right hidden sm:block">
          <div className="font-medium leading-tight">
            {user.full_name || user.email.split("@")[0]}
          </div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit" title="Chiqish">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
