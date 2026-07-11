import { createServerFn } from "@tanstack/react-start";
import type { UnifiedTrack } from "./player-context";

// ---------- Audius ----------
let audiusHost: string | null = null;
async function getAudiusHost(): Promise<string> {
  if (audiusHost) return audiusHost;
  try {
    const res = await fetch("https://api.audius.co");
    const json = (await res.json()) as { data: string[] };
    audiusHost = json.data[Math.floor(Math.random() * json.data.length)];
  } catch {
    audiusHost = "https://discoveryprovider.audius.co";
  }
  return audiusHost!;
}

async function searchAudius(query: string, limit = 20): Promise<UnifiedTrack[]> {
  try {
    const host = await getAudiusHost();
    const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=sonora`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { data: any[] };
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

async function trendingAudius(limit = 20): Promise<UnifiedTrack[]> {
  try {
    const host = await getAudiusHost();
    const res = await fetch(`${host}/v1/tracks/trending?limit=${limit}&app_name=sonora`);
    if (!res.ok) return [];
    const json = (await res.json()) as { data: any[] };
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
async function searchJamendo(query: string, limit = 20): Promise<UnifiedTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=${limit}&search=${encodeURIComponent(query)}&include=musicinfo&audioformat=mp32`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { results: any[] };
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

async function popularJamendo(limit = 20): Promise<UnifiedTrack[]> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=json&limit=${limit}&order=popularity_total&audioformat=mp32`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { results: any[] };
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
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.reallyaweso.me",
];

async function pipedFetch(path: string): Promise<any | null> {
  const shuffled = [...PIPED_INSTANCES].sort(() => Math.random() - 0.5);
  for (const base of shuffled) {
    try {
      const res = await fetch(`${base}${path}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return await res.json();
    } catch {
      continue;
    }
  }
  return null;
}

async function searchPiped(query: string): Promise<UnifiedTrack[]> {
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

// ---------- Server functions exposed to client ----------
export const unifiedSearch = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q) return { youtube: [], jamendo: [], audius: [] };
    const [youtube, jamendo, audius] = await Promise.all([
      searchPiped(q),
      searchJamendo(q),
      searchAudius(q),
    ]);
    return { youtube, jamendo, audius };
  });

export const homeFeed = createServerFn({ method: "GET" }).handler(async () => {
  const [jamendo, audius] = await Promise.all([
    popularJamendo(12),
    trendingAudius(12),
  ]);
  return { jamendo, audius };
});

export const resolveYoutubeStream = createServerFn({ method: "GET" })
  .inputValidator((d: { videoId: string }) => d)
  .handler(async ({ data }) => {
    const json = await pipedFetch(`/streams/${data.videoId}`);
    if (!json) return { streamUrl: null as string | null };
    const audios = (json.audioStreams ?? []) as Array<{
      url: string;
      bitrate: number;
      mimeType?: string;
    }>;
    if (audios.length === 0) return { streamUrl: null };
    const best = audios.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
    return { streamUrl: best.url };
  });
