import { createServerFn } from "@tanstack/react-start";
import {
  chartDeezer,
  popularJamendo,
  resolvePipedStream,
  searchAudius,
  searchDeezer,
  searchJamendo,
  searchPiped,
  trendingAudius,
} from "./music-sources.server";

export const unifiedSearch = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const q = data.q.trim();
    if (!q) return { youtube: [], jamendo: [], audius: [], deezer: [] };
    const [youtube, jamendo, audius, deezer] = await Promise.all([
      searchPiped(q),
      searchJamendo(q),
      searchAudius(q),
      searchDeezer(q),
    ]);
    return { youtube, jamendo, audius, deezer };
  });

export const homeFeed = createServerFn({ method: "GET" }).handler(async () => {
  const [jamendo, audius, deezer] = await Promise.all([
    popularJamendo(12),
    trendingAudius(12),
    chartDeezer(12),
  ]);
  return { jamendo, audius, deezer };
});

export const resolveYoutubeStream = createServerFn({ method: "GET" })
  .inputValidator((d: { videoId: string }) => d)
  .handler(async ({ data }) => {
    return { streamUrl: await resolvePipedStream(data.videoId) };
  });

export const downloadableAlternatives = createServerFn({ method: "GET" })
  .inputValidator((d: { title: string; artist?: string; duration?: number }) => d)
  .handler(async ({ data }) => {
    const title = data.title.trim();
    const artist = data.artist?.trim() ?? "";
    if (!title) return { tracks: [] };

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
        .replace(/official|video|audio|lyrics?|lyric|visualizer|remaster(?:ed)?|hd|hq|4k|feat\.?|ft\.?/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tokens = (value: string) =>
      normalize(value)
        .split(" ")
        .filter((token) => token.length > 2);

    const overlap = (a: string, b: string) => {
      const left = tokens(a);
      const right = new Set(tokens(b));
      if (!left.length || !right.size) return 0;
      return left.filter((token) => right.has(token)).length / left.length;
    };

    const targetTitle = normalize(title);
    const targetArtist = normalize(artist);
    const targetDuration = Number(data.duration) || 0;

    const isVerifiedMatch = (track: { title: string; artist: string; duration: number }) => {
      const candidateTitle = normalize(track.title);
      const titleMatch =
        candidateTitle === targetTitle ||
        candidateTitle.includes(targetTitle) ||
        targetTitle.includes(candidateTitle) ||
        overlap(title, track.title) >= 0.72;
      if (!titleMatch) return false;

      const artistMatch = !targetArtist || overlap(artist, track.artist) >= 0.5;
      if (!artistMatch) return false;

      if (targetDuration > 75 && track.duration > 45) {
        const difference = Math.abs(track.duration - targetDuration);
        return difference <= Math.max(18, targetDuration * 0.18);
      }

      return track.duration > 45;
    };

    const query = [title, artist].filter(Boolean).join(" ");
    const [jamendo, audius] = await Promise.all([
      searchJamendo(query, 8),
      searchAudius(query, 8),
    ]);

    return {
      tracks: [...jamendo, ...audius]
        .filter((track) => Boolean(track.streamUrl) && isVerifiedMatch(track))
        .slice(0, 3),
    };
  });
