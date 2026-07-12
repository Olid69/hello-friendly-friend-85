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

function isYoutubeVideoId(value: string) {
  return /^[a-zA-Z0-9_-]{6,15}$/.test(value);
}

export const Route = createFileRoute("/api/public/youtube-audio")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => {
        const videoId = new URL(request.url).searchParams.get("videoId")?.trim() ?? "";
        if (!isYoutubeVideoId(videoId)) {
          return textResponse("Invalid YouTube video id", 400);
        }

        try {
          const { resolvePipedStream } = await import("@/lib/music-sources.server");
          const streamUrl = await resolvePipedStream(videoId);
          if (!streamUrl) return textResponse("YouTube stream unavailable", 503);

          const range = request.headers.get("range");
          // Many YouTube media hosts reject a plain full-file request from server
          // runtimes, while accepting byte-range media requests. Downloads from
          // fetch()/IndexedDB usually do not send a Range header, so request the
          // whole file as an explicit range instead of doing a non-range fetch.
          const upstreamRange = range ?? "bytes=0-";
          const upstream = await fetch(streamUrl, {
            headers: {
              accept: "audio/*,video/*,*/*;q=0.8",
              range: upstreamRange,
            },
            signal: AbortSignal.timeout(60_000),
          });

          if (!upstream.ok) {
            return textResponse("YouTube media host rejected the stream", 502);
          }

          const body = await upstream.arrayBuffer();
          const headers = new Headers({
            "content-type": upstream.headers.get("content-type") ?? "audio/mp4",
            "cache-control": "no-store",
            ...CORS_HEADERS,
          });
          const acceptRanges = upstream.headers.get("accept-ranges");
          const contentRange = upstream.headers.get("content-range");
          if (acceptRanges) headers.set("accept-ranges", acceptRanges);
          if (contentRange) headers.set("content-range", contentRange);

          return new Response(body, {
            status: upstream.status === 206 ? 206 : 200,
            headers,
          });
        } catch {
          return textResponse("YouTube download failed", 502);
        }
      },
    },
  },
});