import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Radio, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { homeFeed } from "@/lib/music-sources.functions";
import { TrackGrid } from "@/components/track-card";
import { Skeleton } from "@/components/ui/skeleton";


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

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-card/60 p-3">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
      ))}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 animate-float-in">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          {icon}
        </span>
        <h2 className="font-heading text-xl md:text-2xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
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
        <div className="animate-float-in">
          <h1 className="font-heading text-3xl md:text-5xl font-extrabold tracking-tight">
            {greeting}
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            What do you want to listen to today?
          </p>
        </div>

        {isLoading && (
          <div className="mt-10 space-y-8">
            <div>
              <Skeleton className="mb-4 h-6 w-48 rounded" />
              <GridSkeleton />
            </div>
            <div>
              <Skeleton className="mb-4 h-6 w-56 rounded" />
              <GridSkeleton />
            </div>
          </div>
        )}

        {data && (
          <>
            <Section icon={<TrendingUp className="h-4 w-4" />} title="Popular on Jamendo">
              <TrackGrid tracks={data.jamendo} />
            </Section>
            <Section icon={<Radio className="h-4 w-4" />} title="Trending on Audius">
              <TrackGrid tracks={data.audius} />
            </Section>
            <Section icon={<Sparkles className="h-4 w-4" />} title="Deezer Charts (previews)">
              <TrackGrid tracks={data.deezer} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

