import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "সার্চ — Sonora" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <div className="relative max-w-xl">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="গান, শিল্পী বা অ্যালবাম খুঁজো..."
          className="pl-10 h-11 bg-card border-border"
        />
      </div>

      <Tabs defaultValue="all" className="mt-6">
        <TabsList>
          <TabsTrigger value="all">সব</TabsTrigger>
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="free">Free Music</TabsTrigger>
          <TabsTrigger value="previews">Previews</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-6">
          <EmptyState query={q} />
        </TabsContent>
        <TabsContent value="youtube" className="mt-6">
          <EmptyState query={q} label="YouTube" />
        </TabsContent>
        <TabsContent value="free" className="mt-6">
          <EmptyState query={q} label="Jamendo / Audius / FMA" />
        </TabsContent>
        <TabsContent value="previews" className="mt-6">
          <EmptyState query={q} label="Deezer previews" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ query, label }: { query: string; label?: string }) {
  if (!query) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <SearchIcon className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          {label ? `${label}-এ ` : ""}কিছু লিখে সার্চ করো
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">
        "{query}" এর জন্য রেজাল্ট Phase 2-এ যুক্ত হবে
      </p>
    </div>
  );
}
