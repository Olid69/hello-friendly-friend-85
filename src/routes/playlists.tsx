import { createFileRoute, Link } from "@tanstack/react-router";
import { ListMusic, Plus, Trash2 } from "lucide-react";
import { usePlaylists } from "@/lib/library-store";
import { useState } from "react";

export const Route = createFileRoute("/playlists")({
  head: () => ({ meta: [{ title: "Playlists — Sonora" }] }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const { playlists, create, remove } = usePlaylists();
  const [name, setName] = useState("");
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ListMusic className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Playlists</h1>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create(name.trim());
          setName("");
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New playlist name…"
          className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:scale-105 transition-transform"
        >
          <Plus className="h-4 w-4" /> Create
        </button>
      </form>

      {playlists.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          No playlists yet. Create one above.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {playlists.map((p) => (
            <div key={p.id} className="group relative rounded-lg bg-card p-3">
              <Link
                to="/playlists/$id"
                params={{ id: p.id }}
                className="block"
              >
                <div className="flex aspect-square items-center justify-center rounded-md bg-gradient-to-br from-primary/40 to-secondary">
                  <ListMusic className="h-10 w-10 text-primary-foreground" />
                </div>
                <p className="mt-2 truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.tracks.length} track{p.tracks.length === 1 ? "" : "s"}
                </p>
              </Link>
              <button
                onClick={() => {
                  if (confirm(`Delete "${p.name}"?`)) remove(p.id);
                }}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
