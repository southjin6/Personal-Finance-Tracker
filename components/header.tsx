import Image from "next/image";

import { signOut } from "@/app/auth/actions";
import { DashboardNav } from "@/components/dashboard-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function Header({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  return (
    <header className="border-b">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-4">
          <span className="font-semibold tracking-tight">
            Personal Finance Tracker
          </span>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              ) : null}
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {name}
              </span>
            </div>

            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>

        <DashboardNav />
      </div>
    </header>
  );
}
