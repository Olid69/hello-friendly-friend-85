import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Mic2 } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { getLyrics } from "@/lib/lyrics.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lyrics")({
  head: () => ({ meta: [{ title: "Lyrics — Sonora" }] }),
  component: LyricsPage,
});

function LyricsPage() {
  const { current, progress, seek } = usePlayer();
  const fetchFn = useServerFn(getLyrics);
  const activeRef = useRef<HTMLLIElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lyrics", current?.id],
    queryFn: () =>
      fetchFn({
        data: {
          title: current!.title,
          artist: current!.artist,
          duration: current!.duration,
        },
      }),
    enabled: !!current,
  });

  const [activeIdx, setActiveIdx] = useState(-1);
  useEffect(() => {
    if (!data?.synced) return;
    const idx = data.lines.findIndex((l, i) => {
      const next = data.lines[i + 1];
      return progress >= l.time && (!next || progress < next.time);
    });
    setActiveIdx(idx);
  }, [progress, data]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Mic2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Play a track to see lyrics.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-md bg-card">
          {current.artwork && (
            <img src={current.artwork} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold">{current.title}</h1>
          <p className="text-sm text-muted-foreground">{current.artist}</p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading lyrics…</p>}
      {!isLoading && !data && (
        <p className="text-sm text-muted-foreground">
          No lyrics found on LRCLIB for this track.
        </p>
      )}
      {data?.synced && (
        <ul className="space-y-3 pb-40 text-lg">
          {data.lines.map((l, i) => (
            <li
              key={i}
              ref={i === activeIdx ? activeRef : null}
              onClick={() => seek(l.time)}
              className={cn(
                "cursor-pointer transition-all",
                i === activeIdx
                  ? "text-foreground font-bold scale-105"
                  : "text-muted-foreground/70",
              )}
            >
              {l.text || "♪"}
            </li>
          ))}
        </ul>
      )}
      {data && !data.synced && data.text && (
        <pre className="whitespace-pre-wrap pb-40 font-sans text-base text-foreground">
          {data.text}
        </pre>
      )}
    </div>
  );
}
