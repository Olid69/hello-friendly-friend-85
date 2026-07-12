import { createFileRoute } from "@tanstack/react-router";
import { ListMusic, Trash2 } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { TrackList } from "@/components/track-card";

export const Route = createFileRoute("/queue")({
  head: () => ({ meta: [{ title: "Queue — Sonora" }] }),
  component: QueuePage,
});

function QueuePage() {
  const { queue, current, removeFromQueue } = usePlayer();
  const currentIdx = current ? queue.findIndex((t) => t.id === current.id) : -1;
  const upNext = currentIdx >= 0 ? queue.slice(currentIdx + 1) : queue;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ListMusic className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Play Queue</h1>
        </div>
        {upNext.length > 0 && (
          <button
            onClick={() => upNext.forEach((t) => removeFromQueue(t.id))}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
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
        Up Next ({upNext.length})
      </h2>
      <div className="mt-2">
        <TrackList
          tracks={upNext}
          emptyLabel="Nothing queued. Use the ⋮ menu on any track → Add to queue."
          onRemove={(t) => removeFromQueue(t.id)}
        />
      </div>
    </div>
  );
}
