import { useState } from "react";
import { Play, Music2, MoreVertical, Heart, Download, ListPlus, Check } from "lucide-react";
import { usePlayer, type UnifiedTrack } from "@/lib/player-context";
import { useLiked, usePlaylists } from "@/lib/library-store";
import { useDownloads, saveDownload, deleteDownload } from "@/lib/downloads-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const sourceColors: Record<string, string> = {
  youtube: "bg-red-500/20 text-red-300",
  jamendo: "bg-orange-500/20 text-orange-300",
  audius: "bg-purple-500/20 text-purple-300",
  fma: "bg-blue-500/20 text-blue-300",
  deezer: "bg-pink-500/20 text-pink-300",
};

export function TrackMenu({ track }: { track: UnifiedTrack }) {
  const { isLiked, toggleLike } = useLiked();
  const { playlists, create, addTrack } = usePlaylists();
  const { isDownloaded } = useDownloads();
  const [busy, setBusy] = useState(false);
  const liked = isLiked(track.id);
  const downloaded = isDownloaded(track.id);

  const handleDownload = async () => {
    if (downloaded) {
      await deleteDownload(track.id);
      toast.success("Removed from downloads");
      return;
    }
    if (track.source === "youtube") {
      toast.error("YouTube tracks can't be downloaded (streaming only).");
      return;
    }
    if (!track.streamUrl) return;
    setBusy(true);
    try {
      await saveDownload(track, track.streamUrl);
      toast.success("Downloaded for offline");
    } catch {
      toast.error("Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Track options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="end">
        <DropdownMenuItem onClick={() => toggleLike(track)}>
          <Heart className={cn("mr-2 h-4 w-4", liked && "fill-current text-primary")} />
          {liked ? "Remove from Liked" : "Add to Liked"}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ListPlus className="mr-2 h-4 w-4" />
            Add to playlist
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => {
                const name = window.prompt("Playlist name?");
                if (!name) return;
                const pl = create(name);
                addTrack(pl.id, track);
                toast.success(`Added to ${name}`);
              }}
            >
              + New playlist…
            </DropdownMenuItem>
            {playlists.length > 0 && <DropdownMenuSeparator />}
            {playlists.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => {
                  addTrack(p.id, track);
                  toast.success(`Added to ${p.name}`);
                }}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={handleDownload}>
          {downloaded ? (
            <Check className="mr-2 h-4 w-4 text-primary" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {downloaded ? "Downloaded" : busy ? "Downloading…" : "Download offline"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    <div
      onClick={() => playTrack(track, queue)}
      className="group relative flex cursor-pointer flex-col gap-2 rounded-lg bg-card p-3 text-left transition-colors hover:bg-card/70"
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
      <div className="flex min-w-0 items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
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
        <TrackMenu track={track} />
      </div>
    </div>
  );
}

export function TrackGrid({ tracks }: { tracks: UnifiedTrack[] }) {
  if (tracks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tracks found.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {tracks.map((t) => (
        <TrackCard key={t.id} track={t} queue={tracks} />
      ))}
    </div>
  );
}

export function TrackList({
  tracks,
  onRemove,
}: {
  tracks: UnifiedTrack[];
  onRemove?: (t: UnifiedTrack) => void;
}) {
  const { playTrack, current, isPlaying } = usePlayer();
  if (tracks.length === 0) {
    return <p className="text-sm text-muted-foreground">No tracks yet.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-lg bg-card">
      {tracks.map((t, idx) => {
        const active = current?.id === t.id;
        return (
          <li
            key={t.id}
            onClick={() => playTrack(t, tracks)}
            className="flex cursor-pointer items-center gap-3 p-3 hover:bg-secondary/40"
          >
            <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
              {active && isPlaying ? "▶" : idx + 1}
            </span>
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
              {t.artwork && (
                <img src={t.artwork} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", active && "text-primary")}>
                {t.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">{t.artist}</p>
            </div>
            <span
              className={cn(
                "hidden sm:inline rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                sourceColors[t.source],
              )}
            >
              {t.source}
            </span>
            <TrackMenu track={t} />
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t);
                }}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ✕
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
