import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { PlayerBar } from "./player-bar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto pb-40 md:pb-24">{children}</main>
      </div>
      <PlayerBar />
      <MobileNav />
    </div>
  );
}
