import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Sonora" },
      {
        name: "description",
        content: "Terms of use for the Sonora personal-use music streaming app.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-2xl md:text-3xl font-bold">Terms of Service</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This page is maintained by the Sonora app owner. It describes how the
        app is intended to be used.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Personal use only</h2>
          <p className="text-muted-foreground">
            Sonora is provided for personal, non-commercial use. It is not sold,
            published to any app store, or offered as a service to third
            parties.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Third-party content</h2>
          <p className="text-muted-foreground">
            All music, metadata, and artwork surfaced in the app come from
            public third-party APIs (YouTube via Piped, Jamendo, Audius, FMA,
            Deezer). Rights for that content belong to their respective owners.
            You are responsible for using the app in compliance with those
            services' terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Offline downloads</h2>
          <p className="text-muted-foreground">
            Where available, tracks can be cached locally for offline playback
            on your own device. Do not redistribute cached content.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">No warranty</h2>
          <p className="text-muted-foreground">
            The app is provided as-is, without any warranty. Streaming
            reliability depends on the availability of upstream services.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions or issues?{" "}
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
