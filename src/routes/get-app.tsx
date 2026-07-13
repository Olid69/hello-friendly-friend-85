import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  WifiOff,
  Music2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// Prefer GitHub Release URL (auto-built by .github/workflows/build-apk.yml).
// Set VITE_APK_URL in env, e.g. https://github.com/<user>/<repo>/releases/latest/download/sonora.apk
const APK_PATH =
  (import.meta.env.VITE_APK_URL as string | undefined) ?? "/sonora.apk";

const isExternalApkUrl = /^https?:\/\//i.test(APK_PATH);

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the App — Sonora" },
      {
        name: "description",
        content:
          "Download the Sonora Android APK for personal offline music streaming with built-in data saver.",
      },
      { property: "og:title", content: "Sonora — Personal Music APK" },
      {
        property: "og:description",
        content:
          "Install Sonora on Android. Data-saver mode, offline downloads, dark UI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GetAppPage,
});

function GetAppPage() {
  const [status, setStatus] = useState<"checking" | "ready" | "missing">(
    "checking",
  );
  const [size, setSize] = useState<string | null>(null);

  useEffect(() => {
    if (isExternalApkUrl) {
      setStatus("ready");
      return;
    }

    let cancelled = false;
    fetch(APK_PATH, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStatus("missing");
          return;
        }
        const len = res.headers.get("content-length");
        if (len) {
          const mb = Number(len) / 1024 / 1024;
          setSize(`${mb.toFixed(1)} MB`);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/25 via-primary/10 to-background p-6 md:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <Music2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary/80">
              Personal build
            </p>
            <h1 className="text-2xl md:text-4xl font-bold">Get Sonora on Android</h1>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground">
          Install the APK directly on your phone. Runs offline downloads, dark UI,
          6-band equalizer, synced lyrics, and a built-in Data Saver mode so you
          burn as little mobile data as possible.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {status === "ready" ? (
            <a
              href={APK_PATH}
              download="sonora.apk"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02]"
            >
              <Download className="h-5 w-5" />
              Download APK{size ? ` · ${size}` : ""}
            </a>
          ) : status === "checking" ? (
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary/40 px-6 py-3 text-sm font-semibold text-primary-foreground/70"
            >
              <Download className="h-5 w-5 animate-pulse" />
              Checking build…
            </button>
          ) : (
            <div className="inline-flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                APK is not available at this download URL yet. Let GitHub Actions
                finish successfully, then set <code className="mx-1 rounded bg-background/60 px-1">VITE_APK_URL</code>
                to the latest release APK link and redeploy.
              </span>
            </div>
          )}
          <a
            href="#install"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            Install guide
          </a>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <Badge>Android 7+</Badge>
          <Badge>No Play Store</Badge>
          <Badge>Personal use</Badge>
          <Badge>Data-saver ready</Badge>
        </div>
      </section>

      {/* Features */}
      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Feature
          icon={WifiOff}
          title="Offline"
          desc="Save full tracks to phone storage (IndexedDB)."
        />
        <Feature
          icon={Zap}
          title="Data Saver"
          desc="Lower-quality streams, no auto-preload."
        />
        <Feature
          icon={ShieldCheck}
          title="Private"
          desc="No ads, no tracking. Your library, your device."
        />
        <Feature
          icon={Smartphone}
          title="Native feel"
          desc="Capacitor wrapper, works like an installed app."
        />
      </section>

      {/* Install */}
      <section id="install" className="mt-8 rounded-2xl bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold">Install on your phone</h2>
        <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
          <Step n={1}>
            Open this page on your Android phone and tap
            <span className="mx-1 rounded bg-background px-1.5 py-0.5 font-medium text-foreground">
              Download APK
            </span>
            .
          </Step>
          <Step n={2}>
            When the browser warns about an unknown app, choose
            <span className="mx-1 rounded bg-background px-1.5 py-0.5 font-medium text-foreground">
              Settings → Allow from this source
            </span>
            .
          </Step>
          <Step n={3}>
            Tap the downloaded <code className="rounded bg-background px-1">sonora.apk</code>{" "}
            and press <span className="font-medium text-foreground">Install</span>.
          </Step>
          <Step n={4}>
            Open Sonora, sign in (or continue as guest), and enable{" "}
            <span className="font-medium text-foreground">Data Saver</span> from
            Settings if you are on mobile data.
          </Step>
        </ol>
      </section>

      {/* Data saving info */}
      <section className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5 md:p-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">How Sonora saves data</h2>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Streams start at the lowest audio-only bitrate when Data Saver is on.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Downloaded tracks play from IndexedDB — zero network after the first save.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Artwork loads lazily with reduced resolution on Data Saver.
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            No autoplay of preview clips and no next-track prefetch on cellular.
          </li>
        </ul>
      </section>

      {/* Auto-build via GitHub Actions */}
      <section className="mt-6 rounded-2xl bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold">Auto-build via GitHub Actions</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          এই project-এ <code className="rounded bg-background px-1">.github/workflows/build-apk.yml</code>{" "}
          add করা আছে। GitHub-এ push হলে workflow নিজে থেকে APK build করে{" "}
          <span className="font-medium text-foreground">Releases → latest</span>-এ upload করবে।
        </p>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <Step n={1}>Lovable → <span className="font-medium text-foreground">+ menu → GitHub → Connect</span> করে repo বানাও।</Step>
          <Step n={2}>Repo-র <span className="font-medium text-foreground">Actions</span> tab-এ workflow enable করো (প্রথমবার approval লাগতে পারে)।</Step>
          <Step n={3}>Build শেষ হলে repo-র <span className="font-medium text-foreground">Releases</span>-এ <code className="rounded bg-background px-1">sonora.apk</code> পাবে।</Step>
          <Step n={4}>
            Lovable env-এ <code className="rounded bg-background px-1">VITE_APK_URL</code>{" "}
            set করো — যেমন{" "}
            <code className="rounded bg-background px-1">
              https://github.com/&lt;user&gt;/&lt;repo&gt;/releases/latest/download/sonora.apk
            </code>
            । এই page-এর Download button তখনই সরাসরি GitHub Release থেকে APK নামাবে।
          </Step>
        </ol>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Local build (manual, optional)</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-4 text-xs font-mono">
{`bun install
bun run build
bun run cap add android --no-sync # first time only
bun run cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk`}
          </pre>
        </details>
      </section>


      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Sonora is a personal project. Not affiliated with YouTube, Jamendo,
        Audius, or Deezer.
      </p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 backdrop-blur">
      {children}
    </span>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Zap;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
