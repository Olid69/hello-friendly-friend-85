import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/recent")({
  head: () => ({ meta: [{ title: "Recently Played — Sonora" }] }),
  component: RecentPage,
});

function RecentPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold">Recently Played</h1>
      <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">
          No history yet. Auto-tracking starts in Phase 5.
        </p>
      </div>
    </div>
  );
}
