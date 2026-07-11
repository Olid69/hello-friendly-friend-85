import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ListMusic, Clock, Download, Mic2, Sliders } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Library — Sonora" }] }),
  component: LibraryPage,
});

const cards = [
  { to: "/liked", label: "Liked Songs", icon: Heart, desc: "All your favorites" },
  { to: "/playlists", label: "Playlists", icon: ListMusic, desc: "Your custom playlists" },
  { to: "/queue", label: "Queue", icon: ListMusic, desc: "What's playing next" },
  { to: "/recent", label: "Recently Played", icon: Clock, desc: "Your listening history" },
  { to: "/downloads", label: "Downloads", icon: Download, desc: "Offline tracks" },
  { to: "/lyrics", label: "Lyrics", icon: Mic2, desc: "Synced via LRCLIB" },
  { to: "/equalizer", label: "Equalizer", icon: Sliders, desc: "6-band audio EQ" },
] as const;

function LibraryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold">Your Library</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group flex items-center gap-4 rounded-lg bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/20">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{c.label}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
