import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ListMusic, Clock, Download } from "lucide-react";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "লাইব্রেরি — Sonora" }] }),
  component: LibraryPage,
});

const cards = [
  { to: "/liked", label: "লাইকড গান", icon: Heart, desc: "তোমার পছন্দের সব গান" },
  { to: "/queue", label: "কিউ", icon: ListMusic, desc: "এখন যা বাজবে" },
  { to: "/recent", label: "সাম্প্রতিক", icon: Clock, desc: "সদ্য শোনা গান" },
] as const;

function LibraryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="text-2xl md:text-3xl font-bold">তোমার লাইব্রেরি</h1>
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
        <div className="flex items-center gap-4 rounded-lg border border-dashed border-border p-4 opacity-60">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted">
            <Download className="h-6 w-6" />
          </div>
          <div>
            <p className="font-semibold">অফলাইন ডাউনলোড</p>
            <p className="text-xs text-muted-foreground">Phase 7-এ আসবে</p>
          </div>
        </div>
      </div>
    </div>
  );
}
