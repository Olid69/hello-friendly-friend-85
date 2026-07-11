import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/liked")({
  head: () => ({ meta: [{ title: "Liked Songs — Sonora" }] }),
  component: LikedPage,
});

function LikedPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <div className="flex items-end gap-6">
        <div className="flex h-32 w-32 md:h-48 md:w-48 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-4 shadow-2xl">
          <Heart className="h-16 w-16 md:h-24 md:w-24 text-white fill-current" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Playlist
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-extrabold">Liked Songs</h1>
          <p className="mt-2 text-sm text-muted-foreground">0 songs</p>
        </div>
      </div>

      <div className="mt-12 rounded-lg border border-dashed border-border p-12 text-center">
        <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          You haven&apos;t liked any songs yet. Liking is coming in Phase 5.
        </p>
      </div>
    </div>
  );
}
