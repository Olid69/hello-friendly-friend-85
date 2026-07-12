import { useCallback, useEffect, useState } from "react";
import type { UnifiedTrack } from "./player-context";
import { supabase } from "@/integrations/supabase/client";
import {
  getLikedCloud,
  toggleLikedCloud,
  syncLikedCloud,
  getRecentCloud,
  pushRecentCloud,
  getPlaylistsCloud,
  upsertPlaylistCloud,
  deletePlaylistCloud,
} from "./library.functions";

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

function useSession() {
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setHasSession(!!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return hasSession;
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

function mergeById<T extends { id: string }>(a: T[], b: T[]) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of [...a, ...b]) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
  }
  return out;
}

export function useLiked() {
  const hasSession = useSession();
  const [liked, setLiked] = useStore<UnifiedTrack[]>(KEYS.liked, []);

  // Pull + merge on sign-in.
  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await getLikedCloud();
        if (cancelled) return;
        setLiked((local) => {
          const merged = mergeById(cloud, local);
          // Push local-only up to cloud.
          const localOnly = local.filter((l) => !cloud.some((c) => c.id === l.id));
          if (localOnly.length > 0) {
            syncLikedCloud({ data: { tracks: localOnly } }).catch(() => {});
          }
          return merged;
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  const isLiked = (id: string) => liked.some((t) => t.id === id);
  const toggleLike = (track: UnifiedTrack) => {
    let willBeLiked = false;
    setLiked((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      willBeLiked = !exists;
      return exists ? prev.filter((t) => t.id !== track.id) : [track, ...prev];
    });
    if (hasSession) {
      toggleLikedCloud({ data: { track, liked: willBeLiked } }).catch(() => {});
    }
  };
  return { liked, isLiked, toggleLike };
}

export function useRecent() {
  const hasSession = useSession();
  const [recent, setRecent] = useStore<UnifiedTrack[]>(KEYS.recent, []);

  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await getRecentCloud();
        if (cancelled) return;
        setRecent((local) => mergeById([...cloud, ...local], []).slice(0, 50));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  const push = (track: UnifiedTrack) => {
    setRecent((prev) =>
      [track, ...prev.filter((t) => t.id !== track.id)].slice(0, 50),
    );
    if (hasSession) {
      pushRecentCloud({ data: { track } }).catch(() => {});
    }
  };
  const clear = () => setRecent([]);
  return { recent, push, clear };
}

export function usePlaylists() {
  const hasSession = useSession();
  const [playlists, setPlaylists] = useStore<Playlist[]>(KEYS.playlists, []);

  useEffect(() => {
    if (!hasSession) return;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await getPlaylistsCloud();
        if (cancelled) return;
        setPlaylists(cloud);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession]);

  const persist = (pl: Playlist) => {
    if (!hasSession) return;
    upsertPlaylistCloud({
      data: { id: pl.id.startsWith("pl_") ? undefined : pl.id, name: pl.name, tracks: pl.tracks },
    })
      .then((res) => {
        if (res.id !== pl.id) {
          setPlaylists((prev) =>
            prev.map((p) => (p.id === pl.id ? { ...p, id: res.id } : p)),
          );
        }
      })
      .catch(() => {});
  };

  const create = (name: string) => {
    const pl: Playlist = {
      id: `pl_${Date.now()}`,
      name,
      createdAt: Date.now(),
      tracks: [],
    };
    setPlaylists((prev) => [pl, ...prev]);
    persist(pl);
    return pl;
  };
  const remove = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (hasSession && !id.startsWith("pl_")) {
      deletePlaylistCloud({ data: { id } }).catch(() => {});
    }
  };
  const rename = (id: string, name: string) => {
    setPlaylists((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name } : p));
      const pl = next.find((p) => p.id === id);
      if (pl) persist(pl);
      return next;
    });
  };
  const addTrack = (id: string, track: UnifiedTrack) => {
    setPlaylists((prev) => {
      const next = prev.map((p) =>
        p.id === id && !p.tracks.some((t) => t.id === track.id)
          ? { ...p, tracks: [...p.tracks, track] }
          : p,
      );
      const pl = next.find((p) => p.id === id);
      if (pl) persist(pl);
      return next;
    });
  };
  const removeTrack = (id: string, trackId: string) => {
    setPlaylists((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p,
      );
      const pl = next.find((p) => p.id === id);
      if (pl) persist(pl);
      return next;
    });
  };
  return { playlists, create, remove, rename, addTrack, removeTrack };
}
