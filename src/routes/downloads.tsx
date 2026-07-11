import { createFileRoute } from "@tanstack/react-router";
import { Download, Trash2 } from "lucide-react";
import { useDownloads, deleteDownload } from "@/lib/downloads-store";
import { usePlayer } from "@/lib/player-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/downloads")({
  head: () => ({ meta: [{ title: "Downloads — Sonora" }] }),
  component: DownloadsPage,
});

function DownloadsPage() {
  const { downloads } = useDownloads();
  const { playTrack, current, isPlaying } = usePlayer();
  const tracks = downloads.map((d) => d.track);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Download className="h-7 w-7 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Offline Downloads</h1>
      </div>
      {downloads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No downloads yet. Use the track menu (⋮) → "Download offline".
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg bg-card">
          {downloads.map((d) => {
            const active = current?.id === d.track.id;
            return (
              <li
                key={d.track.id}
                onClick={() => playTrack(d.track, tracks)}
                className="flex cursor-pointer items-center gap-3 p-3 hover:bg-secondary/40"
              >
                <div className="h-10 w-10 overflow-hidden rounded bg-muted">
                  {d.track.artwork && (
                    <img src={d.track.artwork} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", active && isPlaying && "text-primary")}>
                    {d.track.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.track.artist} · {(d.blob.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteDownload(d.track.id);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
