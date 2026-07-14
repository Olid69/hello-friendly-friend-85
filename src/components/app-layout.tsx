import { useState, type ReactNode } from "react";
import { Menu, Music2 } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { PlayerBar } from "./player-bar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-nav md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-sidebar-border px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-sidebar-accent/60"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <AppSidebar variant="mobile" onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Sonora</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-40 md:pb-24 [scrollbar-gutter:stable]">
          <div key={pathname} className="animate-page-enter">{children}</div>
        </main>
      </div>
      <PlayerBar />
      <MobileNav />
    </div>
  );
}
