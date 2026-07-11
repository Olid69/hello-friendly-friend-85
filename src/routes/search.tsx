import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { unifiedSearch } from "@/lib/music-sources.functions";
import { TrackGrid } from "@/components/track-card";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — Sonora" }] }),
  component: SearchPage,
});

function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SearchPage() {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q, 400);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => unifiedSearch({ data: { q: debounced } }),
    enabled: debounced.trim().length > 1,
    staleTime: 60_000,
  });

  const yt = data?.youtube ?? [];
  const jm = data?.jamendo ?? [];
  const au = data?.audius ?? [];
  const dz = data?.deezer ?? [];
  const all = [...yt, ...jm, ...au, ...dz];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <div className="relative max-w-xl">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search songs, artists, or albums..."
          className="pl-10 h-11 bg-card border-border"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {debounced.trim().length <= 1 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border p-12 text-center">
          <SearchIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            Start typing to search across YouTube, Jamendo, Audius, and Deezer.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="mt-6">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All ({all.length})</TabsTrigger>
            <TabsTrigger value="youtube">YouTube ({yt.length})</TabsTrigger>
            <TabsTrigger value="jamendo">Jamendo ({jm.length})</TabsTrigger>
            <TabsTrigger value="audius">Audius ({au.length})</TabsTrigger>
            <TabsTrigger value="deezer">Deezer ({dz.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-6"><TrackGrid tracks={all} /></TabsContent>
          <TabsContent value="youtube" className="mt-6"><TrackGrid tracks={yt} /></TabsContent>
          <TabsContent value="jamendo" className="mt-6"><TrackGrid tracks={jm} /></TabsContent>
          <TabsContent value="audius" className="mt-6"><TrackGrid tracks={au} /></TabsContent>
          <TabsContent value="deezer" className="mt-6"><TrackGrid tracks={dz} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

