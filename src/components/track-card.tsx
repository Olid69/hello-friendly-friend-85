import { useState } from "react";
import {
  Play,
  Music2,
  MoreVertical,
  Heart,
  Download,
  ListPlus,
  Check,
  ListEnd,
  ListStart,
  X,
} from "lucide-react";
import { usePlayer, type UnifiedTrack } from "@/lib/player-context";
import { useLiked, usePlaylists } from "@/lib/library-store";
import { useDownloads, saveDownload, deleteDownload } from "@/lib/downloads-store";
import { downloadableAlternatives } from "@/lib/music-sources.functions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type MirrorCandidate = UnifiedTrack & { verified?: boolean };


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
  const { playTrack, addToQueue, playNext } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<MirrorCandidate[]>([]);
  const liked = isLiked(track.id);
  const downloaded = isDownloaded(track.id);

  const saveMirror = async (mirror: MirrorCandidate) => {
    setBusy(true);
    try {
      const trackToSave: UnifiedTrack = {
        ...track,
        source: mirror.source,
        streamUrl: mirror.streamUrl,
        artwork: mirror.artwork || track.artwork,
        duration: mirror.duration || track.duration,
      };
      const url = `/api/public/proxy?u=${encodeURIComponent(mirror.streamUrl!)}`;
      await saveDownload(trackToSave, url);
      toast.success(`Downloaded offline from ${mirror.source}`);
      setPickerOpen(false);
    } catch {
      toast.error("Download failed. Try another match.");
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (downloaded) {
      await deleteDownload(track.id);
      toast.success("Removed from downloads");
      return;
    }
    setBusy(true);
    try {
      if (track.source === "youtube" || track.source === "deezer") {
        const { tracks, verifiedCount } = await downloadableAlternatives({
          data: { title: track.title, artist: track.artist, duration: track.duration },
        });
        if (!tracks.length) {
          throw new Error("No downloadable match found on Jamendo or Audius for this track.");
        }
        const verified = tracks.find((t) => (t as MirrorCandidate).verified);
        if (verified && verifiedCount === 1) {
          await saveMirror(verified as MirrorCandidate);
          return;
        }
        // Multiple candidates or none verified — let the user pick.
        setCandidates(tracks as MirrorCandidate[]);
        setPickerOpen(true);
        return;
      }
      const url = track.streamUrl
        ? `/api/public/proxy?u=${encodeURIComponent(track.streamUrl)}`
        : null;
      if (!url) throw new Error("no stream");
      await saveDownload(track, url);
      toast.success("Downloaded for offline");
    } catch (error) {
      const message =
        error instanceof Error && /(youtube|offline|blocked|verified|match|different beat)/i.test(error.message)
          ? error.message
          : "Download failed. Try Jamendo, Audius, or Deezer if this source blocks saving.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };


  return (
    <>
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
      <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="end" className="w-56">
        <DropdownMenuItem onSelect={() => playTrack(track)}>
          <Play className="mr-2 h-4 w-4" />
          Play now
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { playNext(track); toast.success("Playing next"); }}>
          <ListStart className="mr-2 h-4 w-4" />
          Play next
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { addToQueue(track); toast.success("Added to queue"); }}>
          <ListEnd className="mr-2 h-4 w-4" />
          Add to queue
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toggleLike(track)}>
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
              onSelect={() => {
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
                onSelect={() => {
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
        <DropdownMenuItem disabled={busy} onSelect={(e) => { e.preventDefault(); handleDownload(); }}>
          {downloaded ? (
            <Check className="mr-2 h-4 w-4 text-primary" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {downloaded ? "Downloaded" : busy ? "Downloading…" : "Download offline"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pick a downloadable match</DialogTitle>
          <DialogDescription>
            {track.source === "youtube" ? "YouTube" : "Deezer"} blocks full offline saves. Choose the best match from Jamendo/Audius to store offline.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
          {candidates.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                {c.artwork && <img src={c.artwork} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.title}
                  {c.verified && <span className="ml-2 text-[10px] uppercase text-primary">verified</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.artist} · {c.source} · {Math.round(c.duration)}s
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={() => saveMirror(c)}>
                Save
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
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
  emptyLabel,
}: {
  tracks: UnifiedTrack[];
  onRemove?: (t: UnifiedTrack) => void;
  emptyLabel?: string;
}) {
  const { playTrack, current, isPlaying } = usePlayer();
  if (tracks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {emptyLabel ?? "No tracks yet."}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg bg-card">
      {tracks.map((t, idx) => {
        const active = current?.id === t.id;
        return (
          <li
            key={t.id}
            onClick={() => playTrack(t, tracks)}
            className={cn(
              "flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-secondary/40",
              active && "bg-secondary/30",
            )}
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
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
