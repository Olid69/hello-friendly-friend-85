import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useLiked } from "@/lib/library-store";
import { TrackList } from "@/components/track-card";

export const Route = createFileRoute("/liked")({
  head: () => ({ meta: [{ title: "Liked Songs — Sonora" }] }),
  component: LikedPage,
});

function LikedPage() {
  const { liked, toggleLike } = useLiked();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/40 shadow-xl">
          <Heart className="h-12 w-12 fill-current text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Playlist</p>
          <h1 className="text-3xl md:text-5xl font-bold">Liked Songs</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {liked.length} track{liked.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <TrackList
        tracks={liked}
        onRemove={(t) => toggleLike(t)}
        emptyLabel="No liked songs yet. Tap the heart on any track."
      />
    </div>
  );
}
