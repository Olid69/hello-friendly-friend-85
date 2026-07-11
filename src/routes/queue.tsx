import { createFileRoute } from "@tanstack/react-router";
import { ListMusic } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { TrackList } from "@/components/track-card";

export const Route = createFileRoute("/queue")({
  head: () => ({ meta: [{ title: "Queue — Sonora" }] }),
  component: QueuePage,
});

function QueuePage() {
  const { queue, current } = usePlayer();
  const currentIdx = current ? queue.findIndex((t) => t.id === current.id) : -1;
  const upNext = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <ListMusic className="h-7 w-7 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Play Queue</h1>
      </div>

      {current && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase text-muted-foreground">
            Now Playing
          </h2>
          <div className="mt-2">
            <TrackList tracks={[current]} />
          </div>
        </>
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase text-muted-foreground">
        Up Next
      </h2>
      <div className="mt-2">
        <TrackList tracks={upNext} />
      </div>
    </div>
  );
}
