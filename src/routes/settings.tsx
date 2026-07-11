import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings as SettingsIcon,
  Server,
  Info,
  Sliders,
  Download,
  Mic2,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Sonora" }] }),
  component: SettingsPage,
});

const tools = [
  { to: "/equalizer", label: "Equalizer", icon: Sliders, desc: "6-band Web Audio EQ" },
  { to: "/downloads", label: "Downloads", icon: Download, desc: "Offline library (IndexedDB)" },
  { to: "/lyrics", label: "Lyrics", icon: Mic2, desc: "Synced lyrics via LRCLIB" },
] as const;

function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-lg bg-card p-4 hover:bg-secondary/50 transition-colors"
            >
              <Icon className="h-6 w-6 text-primary" />
              <p className="mt-2 font-semibold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </Link>
          );
        })}
      </div>

      <section className="mt-6 rounded-lg bg-card p-5">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Sources</h2>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><span className="text-red-300 font-mono">YouTube</span> via rotating Piped instances</li>
          <li><span className="text-orange-300 font-mono">Jamendo</span> — Creative Commons full tracks</li>
          <li><span className="text-purple-300 font-mono">Audius</span> — decentralized full tracks</li>
          <li><span className="text-pink-300 font-mono">Deezer</span> — 30s previews (public API)</li>
        </ul>
      </section>

      <section className="mt-4 rounded-lg bg-card p-5">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Build APK</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This project ships with a Capacitor config. To generate an installable APK on
          your machine:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-background p-3 text-xs font-mono">
{`bun run build
bunx cap add android
bunx cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk`}
        </pre>
      </section>

      <section className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Personal Use Only</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Not published to any app store. YouTube audio streams through Piped
          (respects YouTube's ToS). Deezer uses only the public preview API.
        </p>
      </section>
    </div>
  );
}
