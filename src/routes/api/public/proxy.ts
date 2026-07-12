import { createFileRoute } from "@tanstack/react-router";

// Simple pass-through media proxy so the browser can fetch (and download)
// audio streams from third-party sources that lack CORS headers.
export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url).searchParams.get("u");
        if (!url) return new Response("missing url", { status: 400 });
        try {
          const upstream = await fetch(url, {
            headers: { "user-agent": "Mozilla/5.0 Sonora" },
          });
          if (!upstream.ok || !upstream.body) {
            return new Response("upstream failed", { status: 502 });
          }
          return new Response(upstream.body, {
            status: 200,
            headers: {
              "content-type":
                upstream.headers.get("content-type") ?? "audio/mpeg",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        } catch {
          return new Response("proxy error", { status: 502 });
        }
      },
    },
  },
});
