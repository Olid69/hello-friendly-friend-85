import { createFileRoute } from "@tanstack/react-router";
import { Clock, Trash2 } from "lucide-react";
import { useRecent } from "@/lib/library-store";
import { TrackList } from "@/components/track-card";

export const Route = createFileRoute("/recent")({
  head: () => ({ meta: [{ title: "Recently Played — Sonora" }] }),
  component: RecentPage,
});

function RecentPage() {
  const { recent, clear } = useRecent();
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Clock className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Recently Played</h1>
        </div>
        {recent.length > 0 && (
          <button
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <TrackList tracks={recent} emptyLabel="No listening history yet. Play something!" />
    </div>
  );
}
