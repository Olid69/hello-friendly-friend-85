import { Play, Music2 } from "lucide-react";
import { usePlayer, type UnifiedTrack } from "@/lib/player-context";
import { cn } from "@/lib/utils";

const sourceColors: Record<string, string> = {
  youtube: "bg-red-500/20 text-red-300",
  jamendo: "bg-orange-500/20 text-orange-300",
  audius: "bg-purple-500/20 text-purple-300",
  fma: "bg-blue-500/20 text-blue-300",
  deezer: "bg-pink-500/20 text-pink-300",
};

export function TrackCard({
  track,
  queue,
}: {
  track: UnifiedTrack;
  queue?: UnifiedTrack[];
}) {
  const { playTrack, current, isPlaying } = usePlayer();
  const active = current?.id === track.id;
  return (
    <button
      onClick={() => playTrack(track, queue)}
      className="group relative flex flex-col gap-2 rounded-lg bg-card p-3 text-left transition-colors hover:bg-card/70"
    >
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        {track.artwork ? (
          <img
            src={track.artwork}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Music2 className="h-10 w-10" />
          </div>
        )}
        <span
          className={cn(
            "absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase backdrop-blur",
            sourceColors[track.source],
          )}
        >
          {track.source}
        </span>
        <span className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="h-4 w-4 fill-current" />
        </span>
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-medium",
            active && isPlaying && "text-primary",
          )}
        >
          {track.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
      </div>
    </button>
  );
}

export function TrackGrid({ tracks }: { tracks: UnifiedTrack[] }) {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tracks found.</p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {tracks.map((t) => (
        <TrackCard key={t.id} track={t} queue={tracks} />
      ))}
    </div>
  );
}
