import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Heart,
  Music2,
  Mic2,
  ListMusic,
  Loader2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePlayer } from "@/lib/player-context";
import { useLiked } from "@/lib/library-store";
import { Slider } from "@/components/ui/slider";
import { cn, hiResArtwork } from "@/lib/utils";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { haptic } from "@/lib/haptics";

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const sourceColors: Record<string, string> = {
  youtube: "bg-red-500/20 text-red-300",
  jamendo: "bg-orange-500/20 text-orange-300",
  audius: "bg-purple-500/20 text-purple-300",
  fma: "bg-blue-500/20 text-blue-300",
  deezer: "bg-pink-500/20 text-pink-300",
};

export function PlayerBar() {
  const {
    current,
    isPlaying,
    progress,
    duration,
    volume,
    shuffle,
    repeat,
    isLoading,
    error,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openFullPlayer = () => {
    if (current) navigate({ to: "/player" });
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  if (pathname === "/player") return null;
  // Hide mini bar entirely on mobile when nothing is playing — desktop keeps
  // the empty state so users still see the volume/controls affordance.
  const hideOnMobile = !current;

  return (
    <footer
      className={cn(
        "glass-player fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-30 text-player-foreground shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.55)]",
        hideOnMobile && "hidden md:block",
      )}
    >
      {/* Slim always-visible progress track (mobile) */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-[3px] bg-outline-variant/30">
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 md:gap-3 md:px-5 md:py-3">
        {/* Track info */}
        <div
          onClick={openFullPlayer}
          role={current ? "button" : undefined}
          tabIndex={current ? 0 : undefined}
          className={cn(
            "md-interactive flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1.5 py-1 md:w-72 md:flex-none md:px-2",
            current && "cursor-pointer active:scale-[0.98]",
          )}
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-container">
            {current?.artwork ? (
              <img
                src={hiResArtwork(current.artwork)}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (current?.artwork && img.src !== current.artwork) img.src = current.artwork;
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Music2 className="h-5 w-5" />
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">
                {current?.title ?? "Nothing playing"}
              </p>
              {current && (
                <span
                  className={cn(
                    "hidden md:inline shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                    sourceColors[current.source],
                  )}
                >
                  {current.source}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {error ?? (isLoading ? "Loading stream…" : current?.artist ?? "Search and play a track")}
            </p>
          </div>
          <PlayerActions />
        </div>

        {/* Controls */}
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-1 md:gap-3">
            <button
              onClick={toggleShuffle}
              className={cn(
                "hidden md:inline-flex md-interactive rounded-full p-2 transition-colors",
                shuffle ? "text-primary bg-primary-container/50" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              onClick={() => { haptic("light"); prev(); }}
              className="md-interactive rounded-full p-2 text-muted-foreground hover:text-foreground active:scale-90"
              aria-label="Previous"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={() => { haptic("medium"); togglePlay(); }}
              disabled={!current}
              className={cn(
                "md-interactive flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90 disabled:opacity-40 md:h-10 md:w-10",
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current translate-x-[1px]" />
              )}
            </button>
            <button
              onClick={() => { haptic("light"); next(); }}
              className="md-interactive rounded-full p-2 text-muted-foreground hover:text-foreground active:scale-90"
              aria-label="Next"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              onClick={cycleRepeat}
              className={cn(
                "hidden md:inline-flex md-interactive rounded-full p-2 transition-colors",
                repeat !== "off"
                  ? "text-primary bg-primary-container/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Repeat"
            >
              <RepeatIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden md:flex w-full max-w-xl items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
            <span className="w-8 text-right">{fmt(progress)}</span>
            <Slider
              value={[progress]}
              max={duration || 1}
              step={1}
              onValueChange={(v) => seek(v[0] ?? 0)}
              className="flex-1"
            />
            <span className="w-8">{fmt(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="hidden md:flex w-40 items-center gap-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={(v) => setVolume((v[0] ?? 0) / 100)}
          />
        </div>
      </div>
    </footer>
  );
}

function PlayerActions() {
  const { current } = usePlayer();
  const { isLiked, toggleLike } = useLiked();
  if (!current) return null;
  const liked = isLiked(current.id);
  return (
    <div className="hidden md:flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { haptic(liked ? "light" : "medium"); toggleLike(current); }}
        className={cn(
          "md-interactive rounded-full p-2 active:scale-90",
          liked ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Like"
      >
        <Heart className={cn("h-4 w-4 transition-transform", liked && "fill-current scale-110")} />
      </button>
      <Link
        to="/lyrics"
        className="md-interactive rounded-full p-2 text-muted-foreground hover:text-foreground"
        aria-label="Lyrics"
      >
        <Mic2 className="h-4 w-4" />
      </Link>
      <Link
        to="/queue"
        className="md-interactive rounded-full p-2 text-muted-foreground hover:text-foreground"
        aria-label="Queue"
      >
        <ListMusic className="h-4 w-4" />
      </Link>
    </div>
  );
}
