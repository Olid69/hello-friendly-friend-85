export type LyricsResult = {
  synced: boolean;
  text: string;
  lines: { time: number; text: string }[];
};

function parseLrc(lrc: string): { time: number; text: string }[] {
  const lines: { time: number; text: string }[] = [];
  const re = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/;
  for (const raw of lrc.split(/\r?\n/)) {
    const m = raw.match(re);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseFloat(m[2]);
    const text = (m[3] ?? "").trim();
    lines.push({ time: min * 60 + sec, text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(
  title: string,
  artist: string,
  duration?: number,
): Promise<LyricsResult | null> {
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    if (duration) params.set("duration", Math.round(duration).toString());
    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Sonora (personal use)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      // Fallback to search
      const s = await fetch(
        `https://lrclib.net/api/search?${params.toString()}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!s.ok) return null;
      const list = (await s.json()) as any[];
      const best = list?.[0];
      if (!best) return null;
      const synced = best.syncedLyrics ?? "";
      const plain = best.plainLyrics ?? "";
      return synced
        ? { synced: true, text: synced, lines: parseLrc(synced) }
        : { synced: false, text: plain, lines: [] };
    }
    const j = (await res.json()) as any;
    const synced = j.syncedLyrics ?? "";
    const plain = j.plainLyrics ?? "";
    return synced
      ? { synced: true, text: synced, lines: parseLrc(synced) }
      : { synced: false, text: plain, lines: [] };
  } catch {
    return null;
  }
}
