import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, range, accept, origin",
  "access-control-max-age": "86400",
};

const CHUNK_SIZE = 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
const YOUTUBE_UNAVAILABLE_STATUS = 424;
const FULL_YOUTUBE_DOWNLOAD_BLOCKED =
  "Full YouTube offline download is currently blocked by YouTube. Stream this track online or download from Jamendo, Audius, or Deezer.";

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

function normalizeRange(range: string) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(range.trim());
  if (!match) return range;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : start + CHUNK_SIZE - 1;
  const end = Math.min(requestedEnd, start + CHUNK_SIZE - 1);
  return `bytes=${start}-${end}`;
}

function parseContentRange(value: string | null) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(value ?? "");
  if (!match) return null;
  const total = match[3] === "*" ? null : Number(match[3]);
  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total,
  };
}

function parseRequestRange(value: string | null) {
  const match = /^bytes=(\d+)-(\d*)$/i.exec(value ?? "");
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start + CHUNK_SIZE - 1;
  return { start, end: Math.min(end, start + CHUNK_SIZE - 1) };
}

function concatChunks(chunks: Uint8Array[], total: number) {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

function isCompleteDownload(bodyLength: number, expectedLength?: number) {
  if (!expectedLength) return bodyLength > CHUNK_SIZE;
  return bodyLength >= Math.floor(expectedLength * 0.98);
}

async function fetchUpstreamRange(streamUrl: string, range: string) {
  const url = new URL(streamUrl);
  const match = /^bytes=(\d+)-(\d+)$/i.exec(range);
  if (match) {
    // Google/YouTube signed media URLs often authorize a byte interval via a
    // query-string `range` value. Rewriting that query is more reliable than
    // only sending an HTTP Range header for follow-up chunks.
    url.searchParams.set("range", `${match[1]}-${match[2]}`);
  } else {
    url.searchParams.delete("range");
  }
  return fetch(url.toString(), {
    headers: {
      accept: "audio/*,video/*,*/*;q=0.8",
      range,
    },
    signal: AbortSignal.timeout(60_000),
  });
}

async function fetchCompleteAudio(streamUrl: string) {
  const first = await fetchUpstreamRange(streamUrl, `bytes=0-${CHUNK_SIZE - 1}`);
  if (!first.ok) return { response: first };

  const firstBuffer = await first.arrayBuffer();
  const firstChunk = new Uint8Array(firstBuffer);
  const contentType = first.headers.get("content-type") ?? "audio/mp4";
  const contentRange = parseContentRange(first.headers.get("content-range"));

  if (first.status !== 206 || !contentRange?.total) {
    return { body: firstBuffer, contentType, total: undefined };
  }

  const total = contentRange.total;
  if (total > MAX_DOWNLOAD_BYTES) {
    throw new Error("YouTube file is too large for offline download");
  }

  const chunks = [firstChunk];
  let nextStart = contentRange.end + 1;

  while (nextStart < total) {
    const end = Math.min(nextStart + CHUNK_SIZE - 1, total - 1);
    const chunkResponse = await fetchUpstreamRange(streamUrl, `bytes=${nextStart}-${end}`);
    if (!chunkResponse.ok) return { response: chunkResponse };
    const chunkBuffer = await chunkResponse.arrayBuffer();
    const chunk = new Uint8Array(chunkBuffer);
    if (chunk.byteLength === 0) throw new Error("Empty YouTube audio chunk");
    chunks.push(chunk);

    const parsed = parseContentRange(chunkResponse.headers.get("content-range"));
    nextStart = parsed?.end != null ? parsed.end + 1 : nextStart + chunk.byteLength;
  }

  return { body: concatChunks(chunks, total), contentType, total };
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
          const { fetchYoutubeiAudio, resolvePipedStream } = await import("@/lib/music-sources.server");
          const range = request.headers.get("range");
          const requestedRange = parseRequestRange(range);

          if (requestedRange && requestedRange.start > 0) {
            return textResponse("Only the initial YouTube audio range is available for offline saving", 416);
          }

          if (!range) {
            // Full-file download: use youtubei streaming (no range) to fetch
            // the entire audio track, not just the first 1MB preview.
            const fullAudio = await fetchYoutubeiAudio(videoId);
            if (fullAudio && isCompleteDownload(fullAudio.body.byteLength, fullAudio.contentLength)) {
              return new Response(fullAudio.body, {
                status: 200,
                headers: {
                  "content-type": fullAudio.contentType,
                  "content-length": String(fullAudio.body.byteLength),
                  "accept-ranges": "none",
                  "cache-control": "no-store",
                  ...CORS_HEADERS,
                },
              });
            }
            if (fullAudio) return textResponse(FULL_YOUTUBE_DOWNLOAD_BLOCKED, YOUTUBE_UNAVAILABLE_STATUS);
          }

          const directAudio = await fetchYoutubeiAudio(videoId, requestedRange ?? undefined);
          if (directAudio) {
            const headers = new Headers({
              "content-type": directAudio.contentType,
              "content-length": String(directAudio.body.byteLength),
              "accept-ranges": "bytes",
              "cache-control": "no-store",
              ...CORS_HEADERS,
            });
            if (directAudio.range) {
              // YouTube signed media URLs often allow the first byte interval but
              // reject later intervals from this server runtime. Advertising the
              // true upstream size makes browsers/IndexedDB download code request
              // chunk #2, which currently turns into a handled 502. Treat each
              // successful response as a bounded partial object instead, so the
              // client saves/plays the available audio without triggering a
              // second failing range request.
              const total = directAudio.range.end + 1;
              headers.set(
                "content-range",
                `bytes ${directAudio.range.start}-${directAudio.range.end}/${total}`,
              );
            }
            return new Response(directAudio.body, {
              status: directAudio.range ? 206 : 200,
              headers,
            });
          }

          const streamUrl = await resolvePipedStream(videoId);
          if (!streamUrl) return textResponse("YouTube stream unavailable", 503);

          if (!range) {
            const complete = await fetchCompleteAudio(streamUrl);
            if (complete.response && !complete.response.ok) {
              return textResponse(FULL_YOUTUBE_DOWNLOAD_BLOCKED, YOUTUBE_UNAVAILABLE_STATUS);
            }
            if (!complete.body) return textResponse("YouTube download failed", YOUTUBE_UNAVAILABLE_STATUS);
            if (!isCompleteDownload(complete.body.byteLength, complete.total)) {
              return textResponse(FULL_YOUTUBE_DOWNLOAD_BLOCKED, YOUTUBE_UNAVAILABLE_STATUS);
            }

            return new Response(complete.body, {
              status: 200,
              headers: {
                "content-type": complete.contentType ?? "audio/mp4",
                "content-length": String(complete.total ?? complete.body.byteLength),
                "accept-ranges": "bytes",
                "cache-control": "no-store",
                ...CORS_HEADERS,
              },
            });
          }

          const upstream = await fetchUpstreamRange(streamUrl, normalizeRange(range));

          if (!upstream.ok) {
            return textResponse(FULL_YOUTUBE_DOWNLOAD_BLOCKED, YOUTUBE_UNAVAILABLE_STATUS);
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
          return textResponse("YouTube download failed", YOUTUBE_UNAVAILABLE_STATUS);
        }
      },
    },
  },
});