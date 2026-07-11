import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "হোম", icon: Home },
  { to: "/search", label: "সার্চ", icon: Search },
  { to: "/library", label: "লাইব্রেরি", icon: Library },
  { to: "/settings", label: "সেটিংস", icon: Settings },
];

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-border bg-sidebar px-2 pt-2 pb-[env(safe-area-inset-bottom,0.5rem)]">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
