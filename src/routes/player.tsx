import { createFileRoute, useRouter, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Heart, Pause, Play, SkipBack, SkipForward, Music2, Shuffle, Repeat, Repeat1, Mic2, ListMusic } from "lucide-react";

import { Link } from "@tanstack/react-router";
import { usePlayer } from "@/lib/player-context";
import { useLiked } from "@/lib/library-store";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/player")({
  head: () => ({ meta: [{ title: "Now Playing — Sonora" }] }),
  component: PlayerPage,
});

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayerPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const handleClose = () => {
    // Robust dismiss: try history back, fall back to home if we opened deep-linked.
    const canGoBack =
      typeof window !== "undefined" && window.history.length > 1;
    if (canGoBack) {
      router.history.back();
      // Safety net: if the pop didn't happen (e.g. fresh entry), navigate home.
      window.setTimeout(() => {
        if (window.location.pathname === "/player") {
          navigate({ to: "/" });
        }
      }, 250);
    } else {
      navigate({ to: "/" });
    }
  };

  const {
    current,
    isPlaying,
    isLoading,
    progress,
    duration,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    seek,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();
  const { isLiked, toggleLike } = useLiked();

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const liked = current ? isLiked(current.id) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#c8202a] p-4"
      style={{
        backgroundImage:
          "radial-gradient(1200px 800px at 20% 10%, #e0323d 0%, transparent 60%), radial-gradient(900px 700px at 80% 90%, #8a1219 0%, transparent 55%), url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    >
      {/* Close */}
      <button
        onClick={() => router.history.back()}
        aria-label="Close"
        className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+1rem)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/50"
      >
        <ChevronDown className="h-6 w-6" />
      </button>

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-[28px] bg-[#232323] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/5"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      >
        {/* Artwork */}
        <div className="relative overflow-hidden rounded-2xl bg-black shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
          <div className="aspect-square w-full">
            {current?.artwork ? (
              <img
                src={current.artwork}
                alt=""
                className={cn(
                  "h-full w-full object-cover transition-transform duration-700",
                  isPlaying ? "scale-105" : "scale-100",
                )}
                style={
                  isPlaying
                    ? { animation: "sonora-spin 24s linear infinite" }
                    : undefined
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/40">
                <Music2 className="h-16 w-16" />
              </div>
            )}
          </div>
        </div>
        <style>{`@keyframes sonora-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>


        {/* Title / Artist */}
        <div className="mt-5 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold uppercase tracking-tight text-white">
              {current?.title ?? "Nothing playing"}
            </h1>
            <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
              {current?.artist ?? "—"}
            </p>
          </div>
          <button
            onClick={() => current && toggleLike(current)}
            disabled={!current}
            aria-label="Like"
            className={cn(
              "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
              liked ? "text-red-400" : "text-white/60 hover:text-white",
            )}
          >
            <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          </button>
        </div>

        {/* Progress */}
        <div className="mt-5 px-1">
          <Slider
            value={[progress]}
            max={duration || current?.duration || 1}
            step={1}
            onValueChange={(v) => seek(v[0] ?? 0)}
            className="[&_[data-slot=slider-track]]:bg-white/15 [&_[data-slot=slider-range]]:bg-white [&_[data-slot=slider-thumb]]:h-4 [&_[data-slot=slider-thumb]]:w-4 [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:shadow-md"
          />
          <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-white/50">
            <span>{fmt(progress)}</span>
            <span>{fmt(duration || current?.duration || 0)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-center gap-8 pb-2">
          <button
            onClick={toggleShuffle}
            aria-label="Shuffle"
            className={cn(
              "flex h-9 w-9 items-center justify-center transition",
              shuffle ? "text-white" : "text-white/40 hover:text-white/70",
            )}
          >
            <Shuffle className="h-4 w-4" />
          </button>
          <button
            onClick={prev}
            aria-label="Previous"
            className="text-white/90 transition hover:text-white"
          >
            <SkipBack className="h-8 w-8 fill-current" />
          </button>
          <button
            onClick={togglePlay}
            disabled={!current}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white transition hover:scale-105 disabled:opacity-40"
          >
            {isPlaying || isLoading ? (
              <Pause className="h-9 w-9 fill-current" />
            ) : (
              <Play className="h-9 w-9 fill-current" />
            )}
          </button>
          <button
            onClick={next}
            aria-label="Next"
            className="text-white/90 transition hover:text-white"
          >
            <SkipForward className="h-8 w-8 fill-current" />
          </button>
          <button
            onClick={cycleRepeat}
            aria-label="Repeat"
            className={cn(
              "flex h-9 w-9 items-center justify-center transition",
              repeat !== "off" ? "text-white" : "text-white/40 hover:text-white/70",
            )}
          >
            <RepeatIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Extras */}
        <div className="mt-2 flex items-center justify-center gap-6 border-t border-white/5 pt-3 text-white/60">
          <Link to="/lyrics" className="flex items-center gap-1.5 text-xs font-medium hover:text-white">
            <Mic2 className="h-4 w-4" /> Lyrics
          </Link>
          <Link to="/queue" className="flex items-center gap-1.5 text-xs font-medium hover:text-white">
            <ListMusic className="h-4 w-4" /> Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
