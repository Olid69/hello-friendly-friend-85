import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, range, accept, origin",
  "access-control-max-age": "86400",
};

const CHUNK_SIZE = 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024;
const MIN_COMPLETE_DOWNLOAD_BYTES = CHUNK_SIZE + 64 * 1024;
// Any full-song audio is well over 1.5MB. Anything below this is the classic
// YouTube ~1MB throttled stub (no PoToken), never a real complete track.
const MIN_FULL_DOWNLOAD_BYTES = 1_500_000;
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
  if (expectedLength && expectedLength > 0) {
    // Trust the upstream content length — accept if we got ≥98% of it.
    return bodyLength >= Math.floor(expectedLength * 0.98);
  }
  // No length hint: require more than one chunk so we don't save a stub.
  return bodyLength >= MIN_COMPLETE_DOWNLOAD_BYTES;
}

function getContentLengthFromUrl(value: string) {
  try {
    const url = new URL(value);
    const fromClen = Number(url.searchParams.get("clen"));
    if (Number.isFinite(fromClen) && fromClen > 0) return fromClen;
  } catch {}
  return undefined;
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
        const url = new URL(request.url);
        const videoId = url.searchParams.get("videoId")?.trim() ?? "";
        const forceDownload = url.searchParams.get("download") === "1";
        if (!isYoutubeVideoId(videoId)) {
          return textResponse("Invalid YouTube video id", 400);
        }

        try {
          const { fetchYoutubeiAudio, resolvePipedStream } = await import("@/lib/music-sources.server");
          const range = request.headers.get("range");

          // Full-file download path: try youtubei.js full stream first, then
          // fall back to chunked fetching of the Piped/Invidious signed URL.
          if (forceDownload && !range) {
            const fullAudio = await fetchYoutubeiAudio(videoId).catch(() => null);
            if (
              fullAudio &&
              fullAudio.body.byteLength >= MIN_FULL_DOWNLOAD_BYTES &&
              isCompleteDownload(fullAudio.body.byteLength, fullAudio.contentLength)
            ) {
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

            const streamUrl = await resolvePipedStream(videoId);
            if (streamUrl) {
              try {
                const complete = await fetchCompleteAudio(streamUrl);
                if (
                  complete.body &&
                  complete.body.byteLength >= MIN_FULL_DOWNLOAD_BYTES &&
                  isCompleteDownload(complete.body.byteLength, complete.total)
                ) {
                  return new Response(complete.body, {
                    status: 200,
                    headers: {
                      "content-type": complete.contentType ?? "audio/mp4",
                      "content-length": String(complete.body.byteLength),
                      "accept-ranges": "none",
                      "cache-control": "no-store",
                      ...CORS_HEADERS,
                    },
                  });
                }
              } catch {
                // fall through to single-shot fetch
              }

              const single = await fetch(streamUrl, {
                headers: { accept: "audio/*,video/*,*/*;q=0.8" },
                signal: AbortSignal.timeout(90_000),
              }).catch(() => null);
              if (single && single.ok) {
                const body = await single.arrayBuffer();
                const expectedLength = Number(single.headers.get("content-length")) || getContentLengthFromUrl(streamUrl);
                if (
                  body.byteLength >= MIN_FULL_DOWNLOAD_BYTES &&
                  isCompleteDownload(body.byteLength, expectedLength)
                ) {
                  return new Response(body, {
                    status: 200,
                    headers: {
                      "content-type": single.headers.get("content-type") ?? "audio/mp4",
                      "content-length": String(body.byteLength),
                      "accept-ranges": "none",
                      "cache-control": "no-store",
                      ...CORS_HEADERS,
                    },
                  });
                }
              }
            }

            return textResponse(FULL_YOUTUBE_DOWNLOAD_BLOCKED, YOUTUBE_UNAVAILABLE_STATUS);
          }

          // Ranged (streaming/playback) path — used by the audio element.
          const effectiveRange = range ?? `bytes=0-${CHUNK_SIZE - 1}`;
          const requestedRange = parseRequestRange(effectiveRange);
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
              const total = directAudio.range.total ?? directAudio.contentLength;
              headers.set(
                "content-range",
                `bytes ${directAudio.range.start}-${directAudio.range.end}/${total ?? "*"}`,
              );
            }
            return new Response(directAudio.body, {
              status: directAudio.range ? 206 : 200,
              headers,
            });
          }

          const streamUrl = await resolvePipedStream(videoId);
          if (!streamUrl) return textResponse("YouTube stream unavailable", 503);

          const upstream = await fetchUpstreamRange(streamUrl, normalizeRange(effectiveRange));
          if (!upstream.ok) {
            return textResponse(FULL_YOUTUBE_DOWNLOAD_BLOCKED, YOUTUBE_UNAVAILABLE_STATUS);
          }
          const body = await upstream.arrayBuffer();
          const headers = new Headers({
            "content-type": upstream.headers.get("content-type") ?? "audio/mp4",
            "content-length": String(body.byteLength),
            "cache-control": "no-store",
            ...CORS_HEADERS,
          });
          const acceptRanges = upstream.headers.get("accept-ranges");
          const contentRange = upstream.headers.get("content-range");
          if (acceptRanges) headers.set("accept-ranges", acceptRanges);
          if (contentRange) {
            headers.set("content-range", contentRange);
          } else if (requestedRange) {
            const total = getContentLengthFromUrl(streamUrl);
            headers.set(
              "content-range",
              `bytes ${requestedRange.start}-${requestedRange.start + body.byteLength - 1}/${total ?? "*"}`,
            );
          }
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
