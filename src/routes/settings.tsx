import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings as SettingsIcon,
  Server,
  Info,
  Sliders,
  Download,
  Mic2,
  Smartphone,
  Zap,
} from "lucide-react";
import { useDataSaver } from "@/lib/data-saver";

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
  const { dataSaver, toggle } = useDataSaver();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
      </div>

      <section className="mt-6 flex items-center justify-between gap-4 rounded-lg bg-card p-5">
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">Data Saver</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Lower-quality audio, no next-track prefetch, lazy artwork. Best on mobile data.
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={dataSaver}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${dataSaver ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${dataSaver ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </section>

      <Link
        to="/get-app"
        className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 p-5 hover:bg-primary/15 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Download className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Install as Android app</p>
            <p className="text-xs text-muted-foreground">Download the APK and install on your phone.</p>
          </div>
        </div>
        <span className="text-sm font-medium text-primary">Get APK →</span>
      </Link>


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
bun run cap add android --no-sync
bun run cap sync android
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
