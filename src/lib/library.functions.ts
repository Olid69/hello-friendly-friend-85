import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UnifiedTrack } from "./player-context";

const trackSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  artist: z.string(),
  artwork: z.string().optional().default(""),
  duration: z.number().optional().default(0),
  streamUrl: z.string().optional(),
});

// ===== Liked =====
export const getLikedCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("liked_tracks")
      .select("track, liked_at")
      .order("liked_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.track as UnifiedTrack);
  });

export const toggleLikedCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { track: UnifiedTrack; liked: boolean }) => ({
    track: trackSchema.parse(d.track),
    liked: z.boolean().parse(d.liked),
  }))
  .handler(async ({ data, context }) => {
    if (data.liked) {
      await context.supabase.from("liked_tracks").upsert({
        user_id: context.userId,
        track_id: data.track.id,
        track: data.track,
      });
    } else {
      await context.supabase
        .from("liked_tracks")
        .delete()
        .eq("track_id", data.track.id);
    }
    return { ok: true };
  });

export const syncLikedCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tracks: UnifiedTrack[] }) => ({
    tracks: z.array(trackSchema).parse(d.tracks),
  }))
  .handler(async ({ data, context }) => {
    if (data.tracks.length === 0) return { ok: true };
    await context.supabase.from("liked_tracks").upsert(
      data.tracks.map((t) => ({
        user_id: context.userId,
        track_id: t.id,
        track: t,
      })),
      { onConflict: "user_id,track_id" },
    );
    return { ok: true };
  });

// ===== Recent =====
export const getRecentCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recent_tracks")
      .select("track, played_at")
      .order("played_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.track as UnifiedTrack);
  });

export const pushRecentCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { track: UnifiedTrack }) => ({ track: trackSchema.parse(d.track) }))
  .handler(async ({ data, context }) => {
    await context.supabase.from("recent_tracks").upsert({
      user_id: context.userId,
      track_id: data.track.id,
      track: data.track,
      played_at: new Date().toISOString(),
    });
    return { ok: true };
  });

// ===== Playlists =====
export const getPlaylistsCloud = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("playlists")
      .select("id, name, tracks, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      tracks: (p.tracks as UnifiedTrack[]) ?? [],
      createdAt: new Date(p.created_at as string).getTime(),
    }));
  });

export const upsertPlaylistCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; tracks: UnifiedTrack[] }) => ({
    id: d.id,
    name: z.string().min(1).max(100).parse(d.name),
    tracks: z.array(trackSchema).parse(d.tracks),
  }))
  .handler(async ({ data, context }) => {
    if (data.id) {
      await context.supabase
        .from("playlists")
        .update({ name: data.name, tracks: data.tracks })
        .eq("id", data.id);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("playlists")
      .insert({ user_id: context.userId, name: data.name, tracks: data.tracks })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string };
  });

export const deletePlaylistCloud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: z.string().parse(d.id) }))
  .handler(async ({ data, context }) => {
    await context.supabase.from("playlists").delete().eq("id", data.id);
    return { ok: true };
  });

// ===== Profile =====
export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    return data ?? { display_name: null, avatar_url: null };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name?: string; avatar_url?: string }) => ({
    display_name: d.display_name ? z.string().max(80).parse(d.display_name) : undefined,
    avatar_url: d.avatar_url ? z.string().url().max(500).parse(d.avatar_url) : undefined,
  }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, ...data });
    return { ok: true };
  });
