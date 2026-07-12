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
  .inputValidator((d: { title: string; artist?: string }) => d)
  .handler(async ({ data }) => {
    const title = data.title.trim();
    const artist = data.artist?.trim() ?? "";
    if (!title) return { tracks: [] };

    const query = [title, artist].filter(Boolean).join(" ");
    const [jamendo, audius] = await Promise.all([
      searchJamendo(query, 8),
      searchAudius(query, 8),
    ]);

    return {
      tracks: [...jamendo, ...audius].filter((track) => Boolean(track.streamUrl) && track.duration > 45),
    };
  });
