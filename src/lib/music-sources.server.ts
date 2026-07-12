import type { UnifiedTrack } from "./player-context";
import { ClientType, Innertube } from "youtubei.js/cf-worker";

// ---------- Audius ----------
let audiusHost: string | null = null;

async function getAudiusHost(): Promise<string> {
  if (audiusHost) return audiusHost;
  try {
    const res = await fetch("https://api.audius.co", {
      signal: AbortSignal.timeout(6000),
    });
    const json = (await res.json()) as { data?: string[] };
    const hosts = json.data?.filter(Boolean) ?? [];
    audiusHost = hosts.length
      ? hosts[Math.floor(Math.random() * hosts.length)]
      : "https://discoveryprovider.audius.co";
  } catch {
    audiusHost = "https://discoveryprovider.audius.co";
  }
  return audiusHost!;
}

export async function searchAudius(
  query: string,
  limit = 20,
): Promise<UnifiedTrack[]> {
  try {
    const host = await getAudiusHost();
    const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=sonora`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: any[] };
    return (json.data ?? []).map((t) => ({
      id: `audius:${t.id}`,
      source: "audius" as const,
      title: t.title ?? "Unknown",
      artist: t.user?.name ?? "Unknown Artist",
      artwork: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? "",
      duration: t.duration ?? 0,
      streamUrl: `${host}/v1/tracks/${t.id}/stream?app_name=sonora`,
    }));
  } catch {
    return [];
  }
}

export async function trendingAudius(limit = 20): Promise<UnifiedTrack[]> {
  try {
    const host = await getAudiusHost();
    const res = await fetch(
      `${host}/v1/tracks/trending?limit=${limit}&app_name=sonora`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: any[] };
    return (json.data ?? []).map((t) => ({
      id: `audius:${t.id}`,
      source: "audius" as const,
      title: t.title ?? "Unknown",
      artist: t.user?.name ?? "Unknown Artist",
      artwork: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? "",
      duration: t.duration ?? 0,
      streamUrl: `${host}/v1/tracks/${t.id}/stream?app_name=sonora`,
    }));
  } catch {
    return [];
  }
}

// ---------- Jamendo ----------
export async function searchJamendo(
  query: string,
  limit = 20,
): Promise<UnifiedTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo&audioformat=mp32`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: any[] };
    return (json.results ?? []).map((t) => ({
      id: `jamendo:${t.id}`,
      source: "jamendo" as const,
      title: t.name ?? "Unknown",
      artist: t.artist_name ?? "Unknown Artist",
      artwork: t.album_image ?? t.image ?? "",
      duration: t.duration ?? 0,
      streamUrl: t.audio,
    }));
  } catch {
    return [];
  }
}

export async function popularJamendo(limit = 20): Promise<UnifiedTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=${limit}&order=popularity_total&audioformat=mp32`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: any[] };
    return (json.results ?? []).map((t) => ({
      id: `jamendo:${t.id}`,
      source: "jamendo" as const,
      title: t.name ?? "Unknown",
      artist: t.artist_name ?? "Unknown Artist",
      artwork: t.album_image ?? t.image ?? "",
      duration: t.duration ?? 0,
      streamUrl: t.audio,
    }));
  } catch {
    return [];
  }
}

// ---------- Piped (YouTube) ----------
const PIPED_INSTANCES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.orangenet.cc",
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.reallyaweso.me",
];

async function pipedFetch(path: string): Promise<any | null> {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

export async function searchPiped(query: string): Promise<UnifiedTrack[]> {
  const json = await pipedFetch(
    `/search?q=${encodeURIComponent(query)}&filter=music_songs`,
  );
  if (!json?.items) return [];
  return (json.items as any[])
    .filter((it) => it.type === "stream")
    .slice(0, 20)
    .map((t) => {
      const id = String(t.url ?? "").replace("/watch?v=", "");
      return {
        id: `youtube:${id}`,
        source: "youtube" as const,
        title: t.title ?? "Unknown",
        artist: t.uploaderName ?? "Unknown",
        artwork: t.thumbnail ?? "",
        duration: t.duration ?? 0,
      } satisfies UnifiedTrack;
    });
}

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.jing.rocks",
  "https://iv.melmac.space",
  "https://invidious.private.coffee",
  "https://yewtu.be",
];

function pickAudio(audios: Array<{ url?: string; bitrate?: number }>): string | null {
  const playable = audios.filter((a) => a.url);
  if (!playable.length) return null;
  playable.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return playable[0]?.url ?? null;
}

async function canFetchMedia(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        range: "bytes=0-1023",
        accept: "audio/*,video/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    await res.body?.cancel().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

type YoutubeiClient = {
  name: string;
  type: ClientType;
};

const YOUTUBEI_CLIENTS: YoutubeiClient[] = [
  { name: "android-vr", type: ClientType.ANDROID_VR },
  { name: "tv-embedded", type: ClientType.TV_EMBEDDED },
  { name: "ios", type: ClientType.IOS },
  { name: "android", type: ClientType.ANDROID },
  { name: "android-music", type: ClientType.ANDROID_MUSIC },
  { name: "tv", type: ClientType.TV },
  { name: "mweb", type: ClientType.MWEB },
  { name: "web", type: ClientType.WEB },
];

let youtubeiSessions = new Map<string, Awaited<ReturnType<typeof Innertube.create>>>();

function withPotParam(url: string, poToken?: string): string {
  if (!poToken) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("pot")) parsed.searchParams.set("pot", poToken);
    return parsed.toString();
  } catch {
    return url;
  }
}

function extractBestYoutubeiAudio(info: any, poToken?: string): string | null {
  const streamingData = info?.streaming_data;
  const formats = [
    ...(streamingData?.adaptive_formats ?? []),
    ...(streamingData?.formats ?? []),
  ] as any[];
  const audios = formats
    .filter((format) => {
      const mime = String(format?.mime_type ?? format?.mimeType ?? "");
      return format?.url && mime.startsWith("audio");
    })
    .map((format) => ({
      url: withPotParam(String(format.url), poToken),
      bitrate: Number(format.bitrate ?? format.average_bitrate ?? format.averageBitrate) || 0,
    }));
  const audio = pickAudio(audios);
  if (audio) return audio;

  const muxed = formats
    .filter((format) => format?.url)
    .map((format) => ({
      url: withPotParam(String(format.url), poToken),
      bitrate: Number(format.bitrate ?? format.average_bitrate ?? format.averageBitrate) || 0,
    }));
  return pickAudio(muxed);
}

function getYoutubeFormatContentType(format: any) {
  return String(format?.mime_type ?? format?.mimeType ?? "audio/mp4").split(";")[0];
}

function getYoutubeFormatContentLength(format: any) {
  const length = Number(format?.content_length ?? format?.contentLength);
  return Number.isFinite(length) && length > 0 ? length : undefined;
}

function getYoutubeUrlContentLength(value: string) {
  try {
    const length = Number(new URL(value).searchParams.get("clen"));
    return Number.isFinite(length) && length > 0 ? length : undefined;
  } catch {
    return undefined;
  }
}

function getProgressiveYoutubeFormats(info: any) {
  const formats = (info?.streaming_data?.formats ?? []) as any[];
  return formats
    .filter((format) => {
      const mime = String(format?.mime_type ?? format?.mimeType ?? "");
      const hasAudio = format?.has_audio ?? format?.hasAudio;
      const hasVideo = format?.has_video ?? format?.hasVideo;
      return hasAudio && hasVideo && mime.includes("mp4");
    })
    .sort((a, b) => {
      const aLength = getYoutubeFormatContentLength(a) ?? Number.MAX_SAFE_INTEGER;
      const bLength = getYoutubeFormatContentLength(b) ?? Number.MAX_SAFE_INTEGER;
      return aLength - bLength;
    });
}

async function decipherYoutubeFormatUrl(
  format: any,
  innertube: Awaited<ReturnType<typeof Innertube.create>>,
  poToken?: string,
) {
  if (format?.url) return withPotParam(String(format.url), poToken);
  if (typeof format?.decipher !== "function") return null;
  try {
    const player = (innertube as any)?.session?.player;
    return withPotParam(String(await format.decipher(player)), poToken);
  } catch {
    return null;
  }
}

async function fetchWholeYoutubeFormat(
  format: any,
  innertube: Awaited<ReturnType<typeof Innertube.create>>,
  poToken?: string,
) {
  const rawUrl = await decipherYoutubeFormatUrl(format, innertube, poToken);
  if (!rawUrl) return null;

  let url = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    // Some signed URLs arrive with a one-chunk `range` query. For full offline
    // saves we must request the progressive file itself, not that first slice.
    parsed.searchParams.delete("range");
    parsed.searchParams.delete("rn");
    parsed.searchParams.delete("rbuf");
    url = parsed.toString();
  } catch {}

  const expectedLength = getYoutubeFormatContentLength(format) ?? getYoutubeUrlContentLength(url);
  if (expectedLength && expectedLength > YT_MAX_TOTAL) return null;

  try {
    const response = await fetch(url, {
      headers: {
        accept: "audio/*,video/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "com.google.android.youtube/21.03.36(Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
      },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) return null;
    const body = await response.arrayBuffer();
    const responseLength = Number(response.headers.get("content-length")) || undefined;
    const contentLength = expectedLength ?? responseLength;
    const complete = contentLength
      ? body.byteLength >= Math.floor(contentLength * 0.98)
      : body.byteLength > YT_CHUNK + 64 * 1024;
    if (!complete) return null;
    return {
      body,
      contentType: getYoutubeFormatContentType(format),
      contentLength: contentLength ?? body.byteLength,
    };
  } catch {
    return null;
  }
}

async function streamToArrayBuffer(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

const YT_CHUNK = 1024 * 1024; // 1 MiB — matches what YouTube's own player uses
const YT_MAX_TOTAL = 100 * 1024 * 1024;

async function fetchDecipheredRange(
  decipheredUrl: string,
  start: number,
  end: number,
): Promise<ArrayBuffer | null> {
  const url = new URL(decipheredUrl);
  url.searchParams.set("range", `${start}-${end}`);
  // YouTube also accepts &rn= (request number) & &rbuf= hints — behaves better with them.
  const rn = Number(url.searchParams.get("rn") ?? "0") + 1;
  url.searchParams.set("rn", String(rn));
  url.searchParams.set("rbuf", "0");
  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        origin: "https://www.youtube.com",
        referer: "https://www.youtube.com/",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        range: `bytes=${start}-${end}`,
      },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok && response.status !== 206) return null;
    const buffer = await response.arrayBuffer();
    return buffer.byteLength ? buffer : null;
  } catch {
    return null;
  }
}

export async function fetchYoutubeiAudio(
  videoId: string,
  range?: { start: number; end?: number },
): Promise<{
  body: ArrayBuffer;
  contentType: string;
  contentLength?: number;
  range?: { start: number; end: number; total?: number };
} | null> {
  const poToken = process.env.YOUTUBE_PO_TOKEN;
  const visitorData = process.env.YOUTUBE_VISITOR_DATA;

  for (const client of YOUTUBEI_CLIENTS) {
    try {
      const cacheKey = `${client.name}:${poToken ?? ""}:${visitorData ?? ""}`;
      let innertube = youtubeiSessions.get(cacheKey);
      if (!innertube) {
        innertube = await Innertube.create({
          client_type: client.type,
          retrieve_player: true,
          generate_session_locally: true,
          enable_session_cache: false,
          ...(poToken ? { po_token: poToken } : {}),
          ...(visitorData ? { visitor_data: visitorData } : {}),
        });
        youtubeiSessions.set(cacheKey, innertube);
      }

      const info = await innertube.getBasicInfo(videoId, poToken ? { po_token: poToken } : undefined);

      // Full offline save: first try progressive MP4 (audio+video) formats.
      // Mobile YouTube clients still expose these as one complete file, while
      // modern audio-only GVS links often require a PO token after the first 1MB.
      if (!range) {
        for (const progressiveFormat of getProgressiveYoutubeFormats(info)) {
          const direct = await fetchWholeYoutubeFormat(progressiveFormat, innertube, poToken);
          if (direct) return direct;
        }
      }

      const format = info.chooseFormat({ type: "audio", quality: "best", format: "any" } as any) as any;
      const contentLength = getYoutubeFormatContentLength(format);
      const contentType = getYoutubeFormatContentType(format);

      // Decipher once, then reuse the same signed URL for every chunk — this is
      // exactly what YouTube's own player (and Snaptube) does.
      let decipheredUrl: string | null = null;
      if (typeof format?.decipher === "function") {
        try {
          const player = (innertube as any)?.session?.player;
          decipheredUrl = withPotParam(String(await format.decipher(player)), poToken);
        } catch {
          decipheredUrl = null;
        }
      }
      if (!decipheredUrl && format?.url) decipheredUrl = withPotParam(String(format.url), poToken);
      if (!decipheredUrl) continue;

      // ---- Ranged playback request (audio element seeking) ----
      if (range) {
        const start = range.start;
        const end = Math.min(range.end ?? start + YT_CHUNK - 1, start + YT_CHUNK - 1);
        const body = await fetchDecipheredRange(decipheredUrl, start, end);
        if (!body) continue;
        return {
          body,
          contentType,
          contentLength,
          range: { start, end: start + body.byteLength - 1, total: contentLength },
        };
      }

      // ---- Full download: prefer youtubei.js's own streaming pipeline. It
      // handles n-parameter rotation + sequential range continuation the way
      // YouTube's player expects, which no manual loop can reliably reproduce
      // without a valid PoToken.
      try {
        const stream = (await info.download({
          type: "audio",
          quality: "best",
          format: "any",
        } as any)) as ReadableStream<Uint8Array>;
        const body = await streamToArrayBuffer(stream);
        if (body.byteLength > 0) {
          const complete = contentLength
            ? body.byteLength >= Math.floor(contentLength * 0.98)
            : body.byteLength > YT_CHUNK + 64 * 1024; // >1MB stub guard
          if (complete) {
            return { body, contentType, contentLength: contentLength ?? body.byteLength };
          }
        }
      } catch {
        // fall through to manual chunk loop
      }

      // ---- Manual chunk loop (final attempt) ----
      const total = contentLength && contentLength > 0 ? contentLength : YT_MAX_TOTAL;
      if (total > YT_MAX_TOTAL) continue;

      const chunks: Uint8Array[] = [];
      let downloaded = 0;
      let cursor = 0;
      let sawShortChunk = false;
      while (cursor < total) {
        const chunkEnd = Math.min(cursor + YT_CHUNK - 1, total - 1);
        let chunk = await fetchDecipheredRange(decipheredUrl, cursor, chunkEnd);
        if (!chunk) {
          // one retry with a fresh decipher — signatures rotate occasionally
          try {
            const player = (innertube as any)?.session?.player;
            const refreshed = withPotParam(String(await format.decipher(player)), poToken);
            if (refreshed) {
              decipheredUrl = refreshed;
              chunk = await fetchDecipheredRange(decipheredUrl, cursor, chunkEnd);
            }
          } catch {}
        }
        if (!chunk) break;
        const view = new Uint8Array(chunk);
        chunks.push(view);
        downloaded += view.byteLength;
        // If content-length was unknown and we got a short tail, we're done.
        if (view.byteLength < chunkEnd - cursor + 1) {
          sawShortChunk = true;
          break;
        }
        cursor += view.byteLength;
        if (downloaded >= YT_MAX_TOTAL) break;
      }

      if (!downloaded) continue;
      // Accept only when the download is provably complete:
      //  - known content-length reached (≥98%), or
      //  - natural EOF via a short-tail chunk.
      // A stalled mid-download (unknown length + last chunk failed) is NOT complete.
      const looksComplete = contentLength
        ? downloaded >= Math.floor(contentLength * 0.98)
        : sawShortChunk;
      if (!looksComplete) continue;

      const merged = new Uint8Array(downloaded);
      let offset = 0;
      for (const part of chunks) {
        merged.set(part, offset);
        offset += part.byteLength;
      }
      return {
        body: merged.buffer,
        contentType,
        contentLength: contentLength ?? downloaded,
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveYoutubeiStream(videoId: string): Promise<string | null> {
  const poToken = process.env.YOUTUBE_PO_TOKEN;
  const visitorData = process.env.YOUTUBE_VISITOR_DATA;

  for (const client of YOUTUBEI_CLIENTS) {
    try {
      const cacheKey = `${client.name}:${poToken ?? ""}:${visitorData ?? ""}`;
      let innertube = youtubeiSessions.get(cacheKey);
      if (!innertube) {
        innertube = await Innertube.create({
          client_type: client.type,
          retrieve_player: true,
          generate_session_locally: true,
          enable_session_cache: false,
          ...(poToken ? { po_token: poToken } : {}),
          ...(visitorData ? { visitor_data: visitorData } : {}),
        });
        youtubeiSessions.set(cacheKey, innertube);
      }

      const info = await innertube.getBasicInfo(videoId, poToken ? { po_token: poToken } : undefined);
      const stream = extractBestYoutubeiAudio(info, poToken);
      if (stream) return stream;
    } catch {
      continue;
    }
  }

  return null;
}

export async function resolvePipedStream(
  videoId: string,
): Promise<string | null> {
  // Try each Piped instance directly — don't stop at the first that returns
  // JSON, because many instances now return empty streams for YouTube.
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as any;
      const audio = pickAudio(json?.audioStreams ?? []);
      if (audio && (await canFetchMedia(audio))) return audio;
      const videos = (json?.videoStreams ?? []) as Array<{
        url?: string;
        quality?: string;
        videoOnly?: boolean;
      }>;
      const muxed = videos.filter((v) => v.url && !v.videoOnly);
      if (muxed.length) {
        muxed.sort((a, b) => {
          const aq = Number.parseInt(a.quality ?? "0", 10) || 0;
          const bq = Number.parseInt(b.quality ?? "0", 10) || 0;
          return aq - bq;
        });
        if (muxed[0]?.url && (await canFetchMedia(muxed[0].url))) return muxed[0].url;
      }
    } catch {
      continue;
    }
  }

  // Fallback: Invidious instances expose adaptiveFormats with direct URLs.
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetch(
        `${base}/api/v1/videos/${encodeURIComponent(videoId)}?fields=adaptiveFormats,formatStreams`,
        {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(7000),
        },
      );
      if (!res.ok) continue;
      const json = (await res.json()) as any;
      const adaptive = (json?.adaptiveFormats ?? []) as Array<{
        url?: string;
        type?: string;
        bitrate?: string | number;
      }>;
      const audios = adaptive
        .filter((f) => f.url && (f.type ?? "").startsWith("audio"))
        .map((f) => ({ url: f.url, bitrate: Number(f.bitrate) || 0 }));
      const audio = pickAudio(audios);
      if (audio && (await canFetchMedia(audio))) return audio;
      const formats = (json?.formatStreams ?? []) as Array<{ url?: string }>;
      const muxed = formats.find((f) => f.url);
      if (muxed?.url && (await canFetchMedia(muxed.url))) return muxed.url;
    } catch {
      continue;
    }
  }

  const youtubei = await resolveYoutubeiStream(videoId);
  if (youtubei && (await canFetchMedia(youtubei))) return youtubei;

  return null;
}


// ---------- Deezer (30s previews via public API) ----------
export async function searchDeezer(
  query: string,
  limit = 20,
): Promise<UnifiedTrack[]> {
  try {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: any[] };
    return (json.data ?? [])
      .filter((t) => t.preview)
      .map((t) => ({
        id: `deezer:${t.id}`,
        source: "deezer" as const,
        title: t.title ?? "Unknown",
        artist: t.artist?.name ?? "Unknown Artist",
        artwork: t.album?.cover_big ?? t.album?.cover_medium ?? "",
        duration: 30,
        streamUrl: t.preview,
      }));
  } catch {
    return [];
  }
}

export async function chartDeezer(limit = 12): Promise<UnifiedTrack[]> {
  try {
    const res = await fetch(`https://api.deezer.com/chart/0/tracks?limit=${limit}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: any[] };
    return (json.data ?? [])
      .filter((t) => t.preview)
      .map((t) => ({
        id: `deezer:${t.id}`,
        source: "deezer" as const,
        title: t.title ?? "Unknown",
        artist: t.artist?.name ?? "Unknown Artist",
        artwork: t.album?.cover_big ?? t.album?.cover_medium ?? "",
        duration: 30,
        streamUrl: t.preview,
      }));
  } catch {
    return [];
  }
}
