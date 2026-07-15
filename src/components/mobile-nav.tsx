import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Library, User, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { haptic } from "@/lib/haptics";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/player") return null;


  return (
    <nav
      className="glass-nav md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-outline-variant/50 px-2 pt-2 pb-[env(safe-area-inset-bottom,0.5rem)]"
      role="navigation"
      aria-label="Primary"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => haptic("selection")}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition-colors active:scale-[0.94]",
              active ? "text-on-secondary-container" : "text-muted-foreground",
            )}
          >
            <span className="relative flex h-8 w-16 items-center justify-center">
              {active && (
                <motion.span
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 rounded-full bg-secondary-container"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <Icon
                className={cn(
                  "relative h-5 w-5 transition-transform",
                  active && "scale-110",
                )}
                strokeWidth={active ? 2.4 : 2}
              />
            </span>
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
