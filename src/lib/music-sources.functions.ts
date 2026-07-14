import { createServerFn } from "@tanstack/react-start";
import {
  chartDeezer,
  popularJamendo,
  resolvePipedStream,
  searchAudius,
  searchDeezer,
  searchJamendo,
  searchPiped,
  searchPipedVideos,
  trendingAudius,
  trendingPiped,
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
  const [youtube, jamendo, audius, deezer] = await Promise.all([
    trendingPiped(12),
    popularJamendo(12),
    trendingAudius(12),
    chartDeezer(12),
  ]);
  return { youtube, jamendo, audius, deezer };
});

export const youtubeTrending = createServerFn({ method: "GET" }).handler(async () => {
  return { tracks: await trendingPiped(12) };
});

export const resolveYoutubeStream = createServerFn({ method: "GET" })
  .inputValidator((d: { videoId: string }) => d)
  .handler(async ({ data }) => {
    return { streamUrl: await resolvePipedStream(data.videoId) };
  });

export const youtubeDownloadCandidates = createServerFn({ method: "GET" })
  .inputValidator((d: { title: string; artist?: string; duration?: number; excludeId?: string }) => d)
  .handler(async ({ data }) => {
    const title = data.title.trim();
    const artist = data.artist?.trim() ?? "";
    const query = [title, artist].filter(Boolean).join(" ").trim();
    if (!query) return { tracks: [] };

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
        .replace(/official|music|video|audio|lyrics?|lyric|visualizer|remaster(?:ed)?|hd|hq|4k|feat\.?|ft\.?/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
    const tokens = (value: string) => normalize(value).split(" ").filter((token) => token.length > 1);
    const overlap = (left: string, right: string) => {
      const wanted = tokens(left);
      const got = new Set(tokens(right));
      if (!wanted.length || !got.size) return 0;
      return wanted.filter((token) => got.has(token)).length / wanted.length;
    };

    const targetDuration = Number(data.duration) || 0;
    const tracks = await searchPipedVideos(query, 12);
    const scored = tracks
      .filter((track) => track.id.replace(/^youtube:/, "") !== data.excludeId)
      .filter((track) => track.duration > 45)
      .map((track) => {
        const titleScore = Math.max(overlap(title, track.title), overlap(track.title, title));
        const artistScore = artist ? Math.max(overlap(artist, track.artist), overlap(track.artist, artist)) : 0.5;
        const durationDiff = targetDuration ? Math.abs(track.duration - targetDuration) : 0;
        const durationScore = !targetDuration
          ? 0.5
          : durationDiff <= 12
            ? 1
            : durationDiff <= 45
              ? 0.85
              : durationDiff <= 90
                ? 0.55
                : 0.2;
        const officialBoost = /official|audio|lyrics?|lyric/i.test(track.title) ? 0.08 : 0;
        const score = titleScore * 0.52 + artistScore * 0.26 + durationScore * 0.22 + officialBoost;
        return { track, score: Math.min(score, 1) };
      })
      .filter((entry) => entry.score >= 0.48)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return {
      tracks: scored.map((entry) => ({
        ...entry.track,
        matchScore: Number(entry.score.toFixed(2)),
      })),
    };
  });

export const downloadableAlternatives = createServerFn({ method: "GET" })
  .inputValidator((d: { title: string; artist?: string; duration?: number; query?: string; strict?: boolean }) => d)
  .handler(async ({ data }) => {
    const title = data.title.trim();
    const artist = data.artist?.trim() ?? "";
    const manualQuery = data.query?.trim() ?? "";
    if (!title && !manualQuery) return { tracks: [], verifiedCount: 0 };

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
        .replace(/official|video|audio|lyrics?|lyric|visualizer|remaster(?:ed)?|hd|hq|4k|feat\.?|ft\.?|sped\s*up|slowed|reverb/g, " ")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tokens = (value: string) =>
      normalize(value)
        .split(" ")
        .filter((token) => token.length > 1);

    const overlap = (a: string, b: string) => {
      const left = tokens(a);
      const right = new Set(tokens(b));
      if (!left.length || !right.size) return 0;
      return left.filter((token) => right.has(token)).length / left.length;
    };

    const targetTitle = normalize(title);
    const targetArtist = normalize(artist);
    const targetDuration = Number(data.duration) || 0;

    const scoreMatch = (track: { title: string; artist: string; duration: number }) => {
      const candidateTitle = normalize(track.title);
      let titleScore = overlap(title, track.title);
      if (candidateTitle === targetTitle) titleScore = 1;
      else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle))
        titleScore = Math.max(titleScore, 0.85);

      const artistScore = !targetArtist ? 0.5 : overlap(artist, track.artist);

      let durationScore = 0.5;
      if (targetDuration > 30 && track.duration > 30) {
        const diff = Math.abs(track.duration - targetDuration);
        durationScore = diff <= 8 ? 1 : diff <= 20 ? 0.8 : diff <= 45 ? 0.5 : 0.2;
      }

      const score = titleScore * 0.6 + artistScore * 0.25 + durationScore * 0.15;
      const verified =
        titleScore >= 0.72 &&
        (!targetArtist || artistScore >= 0.5) &&
        track.duration > 45 &&
        (targetDuration <= 75 || Math.abs(track.duration - targetDuration) <= Math.max(18, targetDuration * 0.18));

      return { score, verified };
    };

    const query = manualQuery || [title, artist].filter(Boolean).join(" ");
    const fallbackQuery = normalize(title) && normalize(title) !== normalize(query) ? title : "";
    const searches = [query, fallbackQuery].filter(Boolean);

    const resultSets = await Promise.all(
      searches.map(async (q) => {
        const [jamendo, audius] = await Promise.all([
          searchJamendo(q, 12),
          searchAudius(q, 12),
        ]);
        return [...jamendo, ...audius];
      }),
    );

    const seen = new Set<string>();
    const allTracks = resultSets
      .flat()
      .filter((track) => {
        if (seen.has(track.id)) return false;
        seen.add(track.id);
        return true;
      });

    const strict = data.strict !== false;
    const scored = allTracks
      .filter((track) => Boolean(track.streamUrl) && track.duration > 45)
      .map((track) => ({ track, ...scoreMatch(track) }))
      .filter((entry) => (strict ? entry.score >= 0.35 : entry.score >= 0.05))
      .sort((a, b) => Number(b.verified) - Number(a.verified) || b.score - a.score)
      .slice(0, strict ? 8 : 12);

    return {
      tracks: scored.map((entry) => ({
        ...entry.track,
        verified: entry.verified,
        matchScore: Number(entry.score.toFixed(2)),
      })),
      verifiedCount: scored.filter((entry) => entry.verified).length,
    };
  });
