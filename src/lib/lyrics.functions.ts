import { createServerFn } from "@tanstack/react-start";
import { fetchLyrics } from "./lyrics.server";

export const getLyrics = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { title: string; artist: string; duration?: number }) => data,
  )
  .handler(async ({ data }) => {
    return await fetchLyrics(data.title, data.artist, data.duration);
  });
