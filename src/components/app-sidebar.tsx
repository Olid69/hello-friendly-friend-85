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
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { motion } from "motion/react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Your Library", icon: Library },
] as const;

const libraryItems = [
  { to: "/liked", label: "Liked Songs", icon: Heart },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
  { to: "/queue", label: "Queue", icon: ListMusic },
  { to: "/recent", label: "Recently Played", icon: Clock },
  { to: "/downloads", label: "Downloads", icon: Download },
] as const;

const toolItems = [
  { to: "/lyrics", label: "Lyrics", icon: Mic2 },
  { to: "/equalizer", label: "Equalizer", icon: Sliders },
  { to: "/appearance", label: "Appearance", icon: Palette },
  { to: "/get-app", label: "Get APK", icon: Download },
] as const;

function NavItem({
  to,
  label,
  Icon,
  active,
  size = "md",
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  size?: "md" | "sm";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors",
        size === "md" ? "py-2.5" : "py-2",
        active
          ? "text-on-secondary-container"
          : "text-sidebar-foreground/85 hover:text-sidebar-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-pill"
          className="absolute inset-0 rounded-full bg-secondary-container"
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
        />
      )}
      <Icon className={cn("relative", size === "md" ? "h-5 w-5" : "h-4 w-4")} />
      <span className="relative truncate">{label}</span>
    </Link>
  );
}

export function AppSidebar({
  variant = "desktop",
  onNavigate,
}: { variant?: "desktop" | "mobile"; onNavigate?: () => void } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, user } = useAuth();
  const displayName =
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ??
    (user?.user_metadata as { name?: string } | undefined)?.name ??
    user?.email?.split("@")[0] ??
    "";
  const avatarUrl = (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url;
  const initial = (displayName || "U").charAt(0).toUpperCase();

  const asideClass =
    variant === "mobile"
      ? "flex h-full w-full flex-col bg-sidebar overflow-y-auto"
      : "hidden md:flex w-64 flex-col bg-sidebar border-r border-outline-variant/30 overflow-y-auto";

  return (
    <aside
      className={asideClass}
      onClick={(e) => {
        if (onNavigate && (e.target as HTMLElement).closest("a")) onNavigate();
      }}
    >
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
          <Music2 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-heading text-lg font-semibold text-sidebar-foreground">Sonora</span>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Material You</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            Icon={item.icon}
            active={pathname === item.to}
          />
        ))}
      </nav>

      <div className="mt-6 px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Your Collection
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {libraryItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            Icon={item.icon}
            active={pathname === item.to}
            size="sm"
          />
        ))}
      </nav>

      <div className="mt-6 px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Tools
      </div>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {toolItems.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            Icon={item.icon}
            active={pathname === item.to}
            size="sm"
          />
        ))}
      </nav>

      <div className="mt-auto p-3">
        {session ? (
          <Link
            to="/profile"
            className={cn(
              "md-interactive flex items-center gap-3 rounded-2xl bg-surface-container-high px-3 py-2.5 text-sm transition-colors",
            )}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/30" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">✓ Synced</p>
            </div>
          </Link>
        ) : (
          <Link
            to="/auth"
            className="md-interactive flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}
        <Link
          to="/settings"
          className={cn(
            "mt-2 flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors",
            pathname === "/settings"
              ? "bg-secondary-container text-on-secondary-container"
              : "text-sidebar-foreground/85 hover:bg-surface-container-high",
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
