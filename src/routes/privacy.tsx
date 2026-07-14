import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sonora" },
      {
        name: "description",
        content:
          "How Sonora handles your data — a personal-use music streaming app.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <Link
        to="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-2xl md:text-3xl font-bold">Privacy Policy</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is maintained by the Sonora app owner to answer common
        privacy questions about the app. It is app-owned content and is not an
        independent certification.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">What Sonora is</h2>
          <p className="text-muted-foreground">
            Sonora is a personal-use music streaming app. It aggregates public
            music APIs (YouTube via Piped, Jamendo, Audius, Free Music Archive,
            Deezer previews) and plays them in one unified player. It is not
            published to any app store.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Data we store</h2>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>Account email (only if you sign in) — used to sync your library.</li>
            <li>Liked tracks, playlists, and recently-played, tied to your account.</li>
            <li>App preferences (theme, language, data saver) stored locally in your browser.</li>
            <li>Downloaded audio blobs, stored offline in your device's IndexedDB.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">What we do not do</h2>
          <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
            <li>We do not sell your data.</li>
            <li>We do not run advertising or third-party tracking pixels.</li>
            <li>We do not store payment information — the app is free for personal use.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Third-party services</h2>
          <p className="text-muted-foreground">
            Audio streams and search results come from public third-party APIs
            (Piped, Jamendo, Audius, FMA, Deezer, LRCLIB). Their own privacy
            policies apply to any requests made to them.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Deleting your data</h2>
          <p className="text-muted-foreground">
            You can sign out from Settings at any time. Local caches and
            downloaded tracks can be cleared from Settings → Storage &amp; Cache
            and Downloads.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions?{" "}
            <a
              className="text-primary hover:underline"
              href="mailto:support@sonora-stream.lovable.app"
            >
              support@sonora-stream.lovable.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
