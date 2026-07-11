import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Search,
  Library,
  Heart,
  ListMusic,
  Clock,
  Settings,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "হোম", icon: Home },
  { to: "/search", label: "সার্চ", icon: Search },
  { to: "/library", label: "লাইব্রেরি", icon: Library },
];

const libraryItems = [
  { to: "/liked", label: "লাইকড", icon: Heart },
  { to: "/queue", label: "কিউ", icon: ListMusic },
  { to: "/recent", label: "সাম্প্রতিক", icon: Clock },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
          <Music2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">Sonora</span>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        তোমার সংগ্রহ
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {libraryItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-3">
        <Link
          to="/settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60",
          )}
        >
          <Settings className="h-4 w-4" />
          সেটিংস
        </Link>
        <p className="mt-3 px-3 text-[10px] leading-relaxed text-muted-foreground">
          শুধুমাত্র ব্যক্তিগত ব্যবহারের জন্য। Piped-এর মাধ্যমে YouTube ToS মেনে চলে।
        </p>
      </div>
    </aside>
  );
}
