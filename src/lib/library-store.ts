import { useCallback, useEffect, useState } from "react";
import type { UnifiedTrack } from "./player-context";

const KEYS = {
  liked: "sonora.liked",
  recent: "sonora.recent",
  playlists: "sonora.playlists",
} as const;

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  tracks: UnifiedTrack[];
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("sonora:store", { detail: key }));
  } catch {}
}

function useStore<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    setValue(read<T>(key, fallback));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail === key) setValue(read<T>(key, fallback));
    };
    window.addEventListener("sonora:store", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("sonora:store", handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const setAndPersist = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (p: T) => T)(prev)
            : updater;
        write(key, next);
        return next;
      });
    },
    [key],
  );
  return [value, setAndPersist] as const;
}

export function useLiked() {
  const [liked, setLiked] = useStore<UnifiedTrack[]>(KEYS.liked, []);
  const isLiked = (id: string) => liked.some((t) => t.id === id);
  const toggleLike = (track: UnifiedTrack) =>
    setLiked((prev) =>
      prev.some((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : [track, ...prev],
    );
  return { liked, isLiked, toggleLike };
}

export function useRecent() {
  const [recent, setRecent] = useStore<UnifiedTrack[]>(KEYS.recent, []);
  const push = (track: UnifiedTrack) =>
    setRecent((prev) =>
      [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 50),
    );
  const clear = () => setRecent([]);
  return { recent, push, clear };
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useStore<Playlist[]>(KEYS.playlists, []);
  const create = (name: string) => {
    const pl: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      createdAt: Date.now(),
      tracks: [],
    };
    setPlaylists((prev) => [pl, ...prev]);
    return pl;
  };
  const remove = (id: string) =>
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  const rename = (id: string, name: string) =>
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  const addTrack = (id: string, track: UnifiedTrack) =>
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === id && !p.tracks.some((t) => t.id === track.id)
          ? { ...p, tracks: [...p.tracks, track] }
          : p,
      ),
    );
  const removeTrack = (id: string, trackId: string) =>
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
      ),
    );
  return { playlists, create, remove, rename, addTrack, removeTrack };
}
