import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Radio, Sparkles, Youtube, RefreshCw, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { homeFeed, youtubeTrending } from "@/lib/music-sources.functions";
import { TrackGrid } from "@/components/track-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


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
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 animate-float-in">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
          {icon}
        </span>
        <h2 className="font-heading text-xl md:text-2xl font-bold">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

const PULL_THRESHOLD = 70;
const YT_CACHE_KEY = "sonora:yt-trending:v2";
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2000;

type YtFilter = "all" | "bollywood" | "hollywood";
type YoutubeTrendingResult = Awaited<ReturnType<typeof youtubeTrending>>;

function HomePage() {
  const [greeting, setGreeting] = useState("Welcome back");
  const [mounted, setMounted] = useState(false);
  const [cachedYoutubeTracks, setCachedYoutubeTracks] = useState<YoutubeTrendingResult["tracks"]>([]);
  useEffect(() => {
    setGreeting(getGreeting());
    setMounted(true);
  }, []);

  const [ytFilter, setYtFilter] = useState<YtFilter>("all");
  const [yearFrom, setYearFrom] = useState<number>(CURRENT_YEAR - 1);
  const [yearTo, setYearTo] = useState<number>(CURRENT_YEAR);

  const { data, isLoading } = useQuery({
    queryKey: ["home-feed"],
    queryFn: () => homeFeed(),
    staleTime: 5 * 60_000,
  });

  const ytCacheKey = `${YT_CACHE_KEY}:${ytFilter}:${yearFrom}-${yearTo}`;

  const youtubeQuery = useQuery({
    queryKey: ["youtube-trending", ytFilter, yearFrom, yearTo],
    queryFn: () => youtubeTrending({ data: { filter: ytFilter, yearFrom, yearTo } }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(ytCacheKey);
      if (!raw) {
        setCachedYoutubeTracks([]);
        return;
      }
      const parsed = JSON.parse(raw) as { tracks?: YoutubeTrendingResult["tracks"] };
      setCachedYoutubeTracks(parsed?.tracks?.length ? parsed.tracks : []);
    } catch {
      setCachedYoutubeTracks([]);
    }
  }, [mounted, ytCacheKey]);

  useEffect(() => {
    if (!youtubeQuery.data?.tracks?.length) return;
    if (youtubeQuery.isFetching) return;
    try {
      localStorage.setItem(
        ytCacheKey,
        JSON.stringify({ tracks: youtubeQuery.data.tracks, savedAt: Date.now() }),
      );
    } catch {
      // ignore quota errors
    }
  }, [youtubeQuery.data, youtubeQuery.isFetching, ytCacheKey]);

  const youtubeTracks = youtubeQuery.data?.tracks ?? cachedYoutubeTracks;

  // Pull-to-refresh — only when scrolled to top and touch device
  const [pull, setPull] = useState(0);
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
      activeRef.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current || startY.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        setPull(Math.min(dy * 0.5, 120));
      } else {
        setPull(0);
      }
    };
    const onTouchEnd = () => {
      if (activeRef.current && pull >= PULL_THRESHOLD) {
        youtubeQuery.refetch();
      }
      setPull(0);
      activeRef.current = false;
      startY.current = null;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pull, youtubeQuery]);

  const isRefreshing = mounted && youtubeQuery.isFetching;
  const indicatorHeight = mounted ? (isRefreshing ? 48 : pull) : 0;
  const indicatorOpacity = mounted ? Math.min((pull + (isRefreshing ? 60 : 0)) / 60, 1) : 0;

  return (
    <div className="gradient-hero min-h-full">
      {/* Pull-to-refresh indicator */}
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: indicatorHeight }}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-md",
            (isRefreshing || pull >= PULL_THRESHOLD) && "text-primary",
          )}
          style={{
            transform: `rotate(${isRefreshing ? 0 : pull * 3}deg)`,
            opacity: indicatorOpacity,
          }}
        >
          <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
        </div>
      </div>


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

        {(data || youtubeTracks.length > 0) && (
          <>
            <Section
              icon={<Youtube className="h-4 w-4" />}
              title="Popular on YouTube"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => youtubeQuery.refetch()}
                  disabled={isRefreshing}
                  className="gap-2"
                  aria-label="Refresh YouTube trending"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              }
            >
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(["all", "bollywood", "hollywood"] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={ytFilter === f ? "default" : "outline"}
                      onClick={() => setYtFilter(f)}
                      className="h-8 rounded-full capitalize"
                    >
                      {f === "all" ? "All" : f === "bollywood" ? "Bollywood" : "Hollywood"}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Year</span>
                  <select
                    aria-label="Year from"
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                    value={yearFrom}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setYearFrom(v);
                      if (v > yearTo) setYearTo(v);
                    }}
                  >
                    {Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground">–</span>
                  <select
                    aria-label="Year to"
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                    value={yearTo}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setYearTo(v);
                      if (v < yearFrom) setYearFrom(v);
                    }}
                  >
                    {Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setYtFilter("all");
                      setYearFrom(CURRENT_YEAR - 1);
                      setYearTo(CURRENT_YEAR);
                    }}
                    disabled={
                      ytFilter === "all" &&
                      yearFrom === CURRENT_YEAR - 1 &&
                      yearTo === CURRENT_YEAR
                    }
                    className="h-8 rounded-full"
                    aria-label="Reset filters"
                  >
                    Reset
                  </Button>
                </div>
              </div>

              {youtubeQuery.isLoading && youtubeTracks.length === 0 ? (
                <GridSkeleton />
              ) : youtubeQuery.isError && youtubeTracks.length === 0 ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
                >
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="font-medium">Couldn't load YouTube trending</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {(youtubeQuery.error as Error)?.message ??
                        "Check your connection or try again."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => youtubeQuery.refetch()}
                    disabled={isRefreshing}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                    Retry
                  </Button>
                </div>
              ) : youtubeTracks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No trending tracks right now. Try refreshing in a moment.
                </div>
              ) : (
                <div className={cn(isRefreshing && "opacity-60 transition-opacity")}>
                  <TrackGrid tracks={youtubeTracks} />
                </div>
              )}
            </Section>
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
          </>
        )}
      </div>
    </div>
  );
}
