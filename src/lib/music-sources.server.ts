import type { UnifiedTrack } from "./player-context";

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

export async function resolvePipedStream(
  videoId: string,
): Promise<string | null> {
  const json = await pipedFetch(`/streams/${encodeURIComponent(videoId)}`);
  const audios = (json?.audioStreams ?? []) as Array<{
    url?: string;
    bitrate?: number;
    mimeType?: string;
  }>;
  const playable = audios.filter((audio) => audio.url);
  if (playable.length === 0) return null;
  playable.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return playable[0]?.url ?? null;
}