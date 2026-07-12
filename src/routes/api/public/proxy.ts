import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, range, accept, origin",
  "access-control-max-age": "86400",
};

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

// Simple pass-through media proxy so the browser can fetch (and download)
// audio streams from third-party sources that lack CORS headers.
export const Route = createFileRoute("/api/public/proxy")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const url = new URL(request.url).searchParams.get("u");
        if (!url) return textResponse("missing url", 400);

        let target: URL;
        try {
          target = new URL(url);
          if (!/^https?:$/.test(target.protocol)) {
            return textResponse("unsupported url", 400);
          }
        } catch {
          return textResponse("invalid url", 400);
        }

        try {
          const range = request.headers.get("range");
          const upstream = await fetch(target.toString(), {
            headers: {
              "user-agent": "Mozilla/5.0 Sonora",
              accept: "audio/*,video/*,*/*;q=0.8",
              ...(range ? { range } : {}),
            },
          });
          if (!upstream.ok) {
            return textResponse("upstream failed", 502);
          }

          // Buffer the upstream response before returning it. Some preview/browser
          // combinations fail while reading a directly-piped third-party stream,
          // which surfaces as a generic "Download failed" in IndexedDB saves.
          const body = await upstream.arrayBuffer();
          const headers = new Headers({
            "content-type": upstream.headers.get("content-type") ?? "audio/mpeg",
            "cache-control": "no-store",
            ...CORS_HEADERS,
          });
          const acceptRanges = upstream.headers.get("accept-ranges");
          const contentRange = upstream.headers.get("content-range");
          if (acceptRanges) headers.set("accept-ranges", acceptRanges);
          if (contentRange) headers.set("content-range", contentRange);

          return new Response(body, {
            status: upstream.status === 206 ? 206 : 200,
            headers: {
              ...Object.fromEntries(headers.entries()),
            },
          });
        } catch {
          return textResponse("proxy error", 502);
        }
      },
    },
  },
});
