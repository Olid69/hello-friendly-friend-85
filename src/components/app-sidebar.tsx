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
  Download,
  Sliders,
  Mic2,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Your Library", icon: Library },
];

const libraryItems = [
  { to: "/liked", label: "Liked Songs", icon: Heart },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/queue", label: "Queue", icon: ListMusic },
  { to: "/recent", label: "Recently Played", icon: Clock },
  { to: "/downloads", label: "Downloads", icon: Download },
];

const toolItems = [
  { to: "/lyrics", label: "Lyrics", icon: Mic2 },
  { to: "/equalizer", label: "Equalizer", icon: Sliders },
  { to: "/get-app", label: "Get APK", icon: Download },
];

export function AppSidebar({ variant = "desktop", onNavigate }: { variant?: "desktop" | "mobile"; onNavigate?: () => void } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, user } = useAuth();
  const displayName =
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
    (user?.user_metadata as { name?: string } | undefined)?.name ??
    user?.email?.split("@")[0] ??
    "";
  const avatarUrl = (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url;
  const initial = (displayName || "U").charAt(0).toUpperCase();

  const asideClass = variant === "mobile"
    ? "flex h-full w-full flex-col bg-sidebar overflow-y-auto"
    : "hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto";
  return (
    <aside className={asideClass} onClick={(e) => {
      if (onNavigate && (e.target as HTMLElement).closest("a")) onNavigate();
    }}>
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
        Your Collection
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

      <div className="mt-6 px-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tools
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {toolItems.map((item) => {
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
        {session ? (
          <Link
            to="/profile"
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
              pathname === "/profile"
                ? "bg-sidebar-accent"
                : "hover:bg-sidebar-accent/60",
            )}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">Synced</p>
            </div>
          </Link>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-3 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}
        <Link
          to="/settings"
          className={cn(
            "mt-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <p className="mt-3 px-3 text-[10px] leading-relaxed text-muted-foreground">
          For personal use only. Respects YouTube ToS via Piped.
        </p>
      </div>
    </aside>
  );
}
