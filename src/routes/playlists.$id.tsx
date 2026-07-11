import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListMusic, Play, Trash2 } from "lucide-react";
import { usePlaylists } from "@/lib/library-store";
import { usePlayer } from "@/lib/player-context";
import { TrackList } from "@/components/track-card";

export const Route = createFileRoute("/playlists/$id")({
  head: () => ({ meta: [{ title: "Playlist — Sonora" }] }),
  component: PlaylistDetail,
});

function PlaylistDetail() {
  const { id } = Route.useParams();
  const { playlists, remove, removeTrack } = usePlaylists();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();
  const playlist = playlists.find((p) => p.id === id);

  if (!playlist) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Playlist not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="mb-6 flex items-end gap-4">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/60 to-secondary shadow-xl">
          <ListMusic className="h-16 w-16 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase text-muted-foreground">Playlist</p>
          <h1 className="truncate text-3xl md:text-5xl font-bold">{playlist.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {playlist.tracks.length} tracks
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          disabled={playlist.tracks.length === 0}
          onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform disabled:opacity-40"
        >
          <Play className="h-4 w-4 fill-current" /> Play
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${playlist.name}"?`)) {
              remove(playlist.id);
              navigate({ to: "/playlists" });
            }
          }}
          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>

      <TrackList
        tracks={playlist.tracks}
        onRemove={(t) => removeTrack(playlist.id, t.id)}
      />
    </div>
  );
}
