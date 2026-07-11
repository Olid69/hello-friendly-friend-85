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
} from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

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

  return (
    <footer className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-30 border-t border-border bg-player text-player-foreground">
      <div className="flex items-center gap-3 px-3 py-2 md:px-4 md:py-3">
        {/* Track info */}
        <div className="flex min-w-0 flex-1 items-center gap-3 md:w-72 md:flex-none">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-card">
            {current?.artwork ? (
              <img
                src={current.artwork}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Music2 className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">
                {current?.title ?? "Nothing playing"}
              </p>
              {current && (
                <span
                  className={cn(
                    "hidden md:inline shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                    sourceColors[current.source],
                  )}
                >
                  {current.source}
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {error ?? (isLoading ? "Loading stream..." : current?.artist ?? "Search and play a track")}
            </p>
          </div>
          <button
            className="hidden md:inline-flex text-muted-foreground hover:text-primary"
            aria-label="Like"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={toggleShuffle}
              className={cn(
                "hidden md:inline-flex",
                shuffle ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              onClick={prev}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Previous"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              onClick={togglePlay}
              disabled={!current}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105 disabled:opacity-40"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying || isLoading ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </button>
            <button
              onClick={next}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Next"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              onClick={cycleRepeat}
              className={cn(
                "hidden md:inline-flex",
                repeat !== "off"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Repeat"
            >
              <RepeatIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden md:flex w-full max-w-xl items-center gap-2 text-[10px] text-muted-foreground">
            <span className="w-8 text-right tabular-nums">{fmt(progress)}</span>
            <Slider
              value={[progress]}
              max={duration || 1}
              step={1}
              onValueChange={(v) => seek(v[0] ?? 0)}
              className="flex-1"
            />
            <span className="w-8 tabular-nums">{fmt(duration)}</span>
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
