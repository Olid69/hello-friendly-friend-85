import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Radio, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { homeFeed } from "@/lib/music-sources.functions";
import { TrackGrid } from "@/components/track-card";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sonora — Your personal music universe" },
      {
        name: "description",
        content:
          "Personal music streaming across YouTube, Jamendo, and Audius with a unified player.",
      },
    ],
  }),
  component: HomePage,
});

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function HomePage() {
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["home-feed"],
    queryFn: () => homeFeed(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="gradient-hero min-h-full">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <h1 className="text-2xl md:text-4xl font-bold">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What do you want to listen to today?
        </p>

        {isLoading && (
          <div className="mt-16 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {data && (
          <>
            <section className="mt-10">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Popular on Jamendo</h2>
              </div>
              <TrackGrid tracks={data.jamendo} />
            </section>

            <section className="mt-10">
              <div className="mb-4 flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Trending on Audius</h2>
              </div>
              <TrackGrid tracks={data.audius} />
            </section>

            <section className="mt-10">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Deezer Charts (previews)</h2>
              </div>
              <TrackGrid tracks={data.deezer} />
            </section>
          </>
        )}

      </div>
    </div>
  );
}
