import { WifiOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/lib/online-status";
import { useT } from "@/lib/i18n";

/**
 * Slim offline indicator that appears above the mobile nav / player bar when
 * the browser reports no connectivity. Never blocks any UI — downloaded tracks
 * keep playing regardless.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useT();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 -translate-x-1/2 animate-float-in rounded-full border border-destructive/40 bg-destructive/90 px-4 py-2 text-xs font-medium text-destructive-foreground shadow-lg backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4" />
        <span>{t("offline.title")}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-2 inline-flex items-center gap-1 rounded-full bg-background/20 px-2 py-0.5 text-[11px] font-semibold hover:bg-background/30"
        >
          <RefreshCw className="h-3 w-3" />
          {t("offline.retry")}
        </button>
      </div>
    </div>
  );
}
