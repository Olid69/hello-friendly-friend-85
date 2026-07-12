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
  { name: "ios", type: ClientType.IOS },
  { name: "android", type: ClientType.ANDROID },
  { name: "android-music", type: ClientType.ANDROID_MUSIC },
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
