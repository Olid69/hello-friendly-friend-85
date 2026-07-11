import { createServerFn } from "@tanstack/react-start";
import {
  popularJamendo,
  resolvePipedStream,
  searchAudius,
  searchJamendo,
  searchPiped,
  trendingAudius,
} from "./music-sources.server";

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
    return { streamUrl: await resolvePipedStream(data.videoId) };
  });
