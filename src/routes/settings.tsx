import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon, Server, Key, Info } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Sonora" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
      </div>

      <section className="mt-8 rounded-lg bg-card p-5">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Piped Instances</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Public Piped instances used for YouTube audio streaming. Health-checks and
          custom-instance support arrive in Phase 2.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground font-mono">
          <li>pipedapi.kavin.rocks</li>
          <li>pipedapi.tokhmi.xyz</li>
          <li>api.piped.private.coffee</li>
          <li>pipedapi.adminforge.de</li>
        </ul>
      </section>

      <section className="mt-4 rounded-lg bg-card p-5">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">API Keys</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll be asked to configure Jamendo and FMA keys in Phase 2.
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Personal Use</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This app is for personal use only and will not be published to the Play
          Store. YouTube audio streams through Piped, which respects YouTube&apos;s ToS.
        </p>
      </section>
    </div>
  );
}
