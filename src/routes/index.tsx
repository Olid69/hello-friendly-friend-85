import { createFileRoute } from "@tanstack/react-router";
import { Play, TrendingUp, Sparkles, Radio } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Home — Sonora" }],
  }),
  component: HomePage,
});

const mockSections = [
  {
    title: "Trending Now",
    icon: TrendingUp,
    items: [
      { title: "Blinding Lights", artist: "The Weeknd", source: "youtube" },
      { title: "Levitating", artist: "Dua Lipa", source: "deezer" },
      { title: "Stay", artist: "Kid Laroi", source: "youtube" },
      { title: "Peaches", artist: "Justin Bieber", source: "deezer" },
      { title: "Bad Habits", artist: "Ed Sheeran", source: "youtube" },
    ],
  },
  {
    title: "New Releases — Jamendo",
    icon: Sparkles,
    items: [
      { title: "Acoustic Dreams", artist: "Luna Waves", source: "jamendo" },
      { title: "Electric Night", artist: "Neon Pulse", source: "jamendo" },
      { title: "Sunset Drive", artist: "Vintage Roads", source: "jamendo" },
      { title: "Ocean Deep", artist: "Blue Tides", source: "jamendo" },
      { title: "Morning Coffee", artist: "Cafe Sound", source: "jamendo" },
    ],
  },
  {
    title: "From Audius",
    icon: Radio,
    items: [
      { title: "Underground Beat", artist: "DJ Void", source: "audius" },
      { title: "Chill Vibes", artist: "Lo-Fi Master", source: "audius" },
      { title: "Hip Hop Flow", artist: "MC Frost", source: "audius" },
      { title: "House Party", artist: "Bass Drop", source: "audius" },
      { title: "Ambient Space", artist: "Star Dust", source: "audius" },
    ],
  },
];

const sourceColors: Record<string, string> = {
  youtube: "bg-red-500/20 text-red-300",
  jamendo: "bg-orange-500/20 text-orange-300",
  audius: "bg-purple-500/20 text-purple-300",
  fma: "bg-blue-500/20 text-blue-300",
  deezer: "bg-pink-500/20 text-pink-300",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  // Compute greeting only on the client to avoid SSR/client hydration mismatch
  // when the server and client are in different time zones.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <div className="gradient-hero min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="text-2xl md:text-4xl font-bold">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What do you want to listen to today?
        </p>

        {mockSections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="mt-10">
              <div className="mb-4 flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">{section.title}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="group relative flex flex-col gap-3 rounded-lg bg-card p-4 transition-colors hover:bg-secondary"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/40 to-chart-4/30">
                        <span className="text-4xl font-bold opacity-40">
                          {item.title[0]}
                        </span>
                      </div>
                      <button
                        aria-label="Play"
                        className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all group-hover:translate-y-0 group-hover:opacity-100"
                      >
                        <Play className="h-4 w-4 fill-current" />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {item.artist}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${sourceColors[item.source]}`}
                      >
                        {item.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Phase 1 — UI shell only. Real source adapters connect in Phase 2.
        </p>
      </div>
    </div>
  );
}
