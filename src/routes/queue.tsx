import { createFileRoute } from "@tanstack/react-router";
import { ListMusic } from "lucide-react";
import { usePlayer } from "@/lib/player-context";

export const Route = createFileRoute("/queue")({
  head: () => ({ meta: [{ title: "কিউ — Sonora" }] }),
  component: QueuePage,
});

function QueuePage() {
  const { queue, current } = usePlayer();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold">প্লে কিউ</h1>

      {current && (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase text-muted-foreground">
            এখন বাজছে
          </h2>
          <div className="mt-2 rounded-md bg-card p-3">
            <p className="font-medium">{current.title}</p>
            <p className="text-xs text-muted-foreground">{current.artist}</p>
          </div>
        </>
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase text-muted-foreground">
        পরের গানগুলো
      </h2>
      {queue.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-12 text-center">
          <ListMusic className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">কিউ খালি</p>
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {queue.map((t) => (
            <li key={t.id} className="rounded-md p-3 hover:bg-card">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">{t.artist}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
