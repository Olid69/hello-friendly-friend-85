import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { attachEqualizer } from "./equalizer";
import { getDownloadBlobUrl } from "./downloads-store";
import { pushRecentCloud } from "./library.functions";
import { supabase } from "@/integrations/supabase/client";


export type TrackSource = "youtube" | "jamendo" | "audius" | "fma" | "deezer";

export type UnifiedTrack = {
  id: string;
  source: TrackSource;
  title: string;
  artist: string;
  artwork: string;
  duration: number;
  streamUrl?: string;
};

export type RepeatMode = "off" | "all" | "one";
type PlaybackEngine = "audio" | "video" | "youtube" | "native" | null;

type PlayerContextValue = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  current: UnifiedTrack | null;
  queue: UnifiedTrack[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  isLoading: boolean;
  error: string | null;
  playTrack: (track: UnifiedTrack, queue?: UnifiedTrack[]) => void;
  addToQueue: (track: UnifiedTrack) => void;
  playNext: (track: UnifiedTrack) => void;
  removeFromQueue: (id: string) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    SonoraNativeAudio?: {
      play?: (
        streamUrl: string,
        title: string,
        artist: string,
        artwork?: string,
        isPlaying?: boolean,
        positionMs?: number,
        durationMs?: number,
      ) => void;
      control?: (action: string, positionMs?: number) => void;
      start?: (
        title: string,
        artist: string,
        artwork?: string,
        isPlaying?: boolean,
        positionMs?: number,
        durationMs?: number,
      ) => void;
      stop?: () => void;
    };
  }
}


function isNativeAndroidPlayback() {
  if (typeof window === "undefined") return false;
  const capacitor = (window as any).Capacitor;
  if (capacitor?.isNativePlatform?.()) return true;
  return /Android/i.test(navigator.userAgent) && /; wv\)/i.test(navigator.userAgent);
}

function getYouTubeAudioProxyUrl(track: UnifiedTrack, fullDownload = false) {
  const videoId = track.id.replace(/^youtube:/, "");
  const suffix = fullDownload ? "&download=1" : "";
  return `/api/public/youtube-audio?videoId=${encodeURIComponent(videoId)}${suffix}`;
}

function toAbsoluteUrl(url: string) {
  if (typeof window === "undefined") return url;
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const pendingYoutubeVideoIdRef = useRef<string | null>(null);
  const playbackEngineRef = useRef<PlaybackEngine>(null);
  const localObjectUrlRef = useRef<string | null>(null);
  const [current, setCurrent] = useState<UnifiedTrack | null>(null);
  const [queue, setQueue] = useState<UnifiedTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playRequestId, setPlayRequestId] = useState(0);
  const [playbackEngine, setPlaybackEngine] = useState<PlaybackEngine>(null);
  const [restoredProgress, setRestoredProgress] = useState<number | null>(null);
  const hasRestoredRef = useRef(false);

  // Restore last session (current + queue + modes + position) on mount.
  useEffect(() => {
    if (typeof window === "undefined" || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const raw = window.localStorage.getItem("sonora.player.session");
      if (!raw) return;
      const s = JSON.parse(raw) as {
        current?: UnifiedTrack | null;
        queue?: UnifiedTrack[];
        shuffle?: boolean;
        repeat?: RepeatMode;
        progress?: number;
        volume?: number;
      };
      if (s.queue?.length) setQueue(s.queue);
      if (typeof s.shuffle === "boolean") setShuffle(s.shuffle);
      if (s.repeat) setRepeat(s.repeat);
      if (typeof s.volume === "number") setVolumeState(s.volume);
      if (s.current) {
        setRestoredProgress(s.progress ?? 0);
        // Load metadata but don't auto-play (browser autoplay policy).
        setCurrent(s.current);
      }
    } catch {}
  }, []);

  // Persist session whenever key state changes.
  useEffect(() => {
    if (typeof window === "undefined" || !hasRestoredRef.current) return;
    try {
      window.localStorage.setItem(
        "sonora.player.session",
        JSON.stringify({
          current,
          queue,
          shuffle,
          repeat,
          progress,
          volume,
        }),
      );
    } catch {}
  }, [current, queue, shuffle, repeat, progress, volume]);


  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
    youtubePlayerRef.current?.setVolume?.(Math.round(volume * 100));
  }, [volume]);

  const setEngine = (engine: PlaybackEngine) => {
    playbackEngineRef.current = engine;
    setPlaybackEngine(engine);
  };

  const getActiveMedia = () => {
    const engine = playbackEngineRef.current;
    if (engine === "video") return videoRef.current;
    if (engine === "audio") return audioRef.current;
    return null;
  };

  const revokeLocalObjectUrl = () => {
    if (!localObjectUrlRef.current) return;
    URL.revokeObjectURL(localObjectUrlRef.current);
    localObjectUrlRef.current = null;
  };

  const resetMedia = (media: HTMLMediaElement | null) => {
    if (!media) return;
    media.pause();
    media.removeAttribute("src");
    media.load();
  };

  const usableDuration = (value: number, fallback = 0) =>
    Number.isFinite(value) && value > 0 ? value : fallback;

  const finishTrack = () => {
    const media = getActiveMedia();
    if (repeat === "one" && media) {
      media.currentTime = 0;
      media.play().catch(() => {});
    } else if (repeat === "one" && playbackEngineRef.current === "native") {
      window.SonoraNativeAudio?.control?.("seek", 0);
      window.SonoraNativeAudio?.control?.("play", 0);
    } else if (repeat === "one" && playbackEngineRef.current === "youtube") {
      youtubePlayerRef.current?.seekTo?.(0, true);
      youtubePlayerRef.current?.playVideo?.();
    } else {
      next();
    }
  };

  const createYoutubePlayer = () => {
    if (typeof window === "undefined" || youtubePlayerRef.current) return;
    if (!youtubeContainerRef.current || !window.YT?.Player) return;
    youtubePlayerRef.current = new window.YT.Player(youtubeContainerRef.current, {
      height: "1",
      width: "1",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(Math.round(volume * 100));
          const pending = pendingYoutubeVideoIdRef.current;
          if (pending) {
            event.target.loadVideoById(pending);
          }
        },
        onStateChange: (event: any) => {
          const state = event.data;
          if (state === window.YT?.PlayerState?.PLAYING) {
            setIsLoading(false);
            setIsPlaying(true);
            setError(null);
          } else if (state === window.YT?.PlayerState?.PAUSED) {
            setIsPlaying(false);
          } else if (state === window.YT?.PlayerState?.BUFFERING) {
            setIsLoading(true);
          } else if (state === window.YT?.PlayerState?.ENDED) {
            setIsPlaying(false);
            finishTrack();
          }
        },
        onError: () => {
          setIsLoading(false);
          setIsPlaying(false);
          setError("YouTube playback failed. Try another source or track.");
        },
      },
    });
  };

  const ensureYoutubePlayer = () => {
    if (typeof window === "undefined") return;
    if (youtubePlayerRef.current) return;
    if (window.YT?.Player) {
      createYoutubePlayer();
      return;
    }
    window.onYouTubeIframeAPIReady = createYoutubePlayer;
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  };

  useEffect(() => {
    ensureYoutubePlayer();
    return () => {
      youtubePlayerRef.current?.destroy?.();
      youtubePlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (playbackEngine !== "youtube") return;
    const fallbackDuration = current?.duration ?? 0;
    const timer = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player?.getCurrentTime) return;
      setProgress(player.getCurrentTime() || 0);
      setDuration(usableDuration(player.getDuration?.() || 0, fallbackDuration));
    }, 500);
    return () => window.clearInterval(timer);
  }, [current, playbackEngine]);

  // Load stream when current changes (resolves YouTube via Piped on demand).
  useEffect(() => {
    if (!current) return;
    // On a restored session (page reload), don't auto-start streams — wait for user gesture.
    if (restoredProgress !== null && playRequestId === 0) {
      setIsLoading(false);
      setIsPlaying(false);
      setProgress(restoredProgress);
      setDuration(current.duration || 0);
      return;
    }
    let cancelled = false;


    // Track recent plays (persist to localStorage + cloud if signed in).
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("sonora.recent");
        const prev = raw ? (JSON.parse(raw) as UnifiedTrack[]) : [];
        const next = [current, ...prev.filter((t) => t.id !== current.id)].slice(0, 50);
        window.localStorage.setItem("sonora.recent", JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("sonora:store", { detail: "sonora.recent" }));
      } catch {}
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          pushRecentCloud({ data: { track: current } }).catch(() => {});
        }
      });
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      setProgress(0);
      setDuration(current.duration || 0);
      revokeLocalObjectUrl();
      const previousEngine = playbackEngineRef.current;
      setEngine(null);
      resetMedia(audioRef.current);
      resetMedia(videoRef.current);
      if (previousEngine === "native") {
        window.SonoraNativeAudio?.stop?.();
      }

      // Try local download first for any source.
      let localUrl: string | null = null;
      try {
        localUrl = await getDownloadBlobUrl(current.id);
      } catch {}
      if (cancelled) return;

      if (localUrl) {
        youtubePlayerRef.current?.stopVideo?.();
        localObjectUrlRef.current = localUrl;
        setEngine("audio");
        const media = audioRef.current;
        if (!media) return;
        media.src = localUrl;
        try {
          await media.play();
          if (!cancelled) {
            setIsPlaying(true);
            setError(null);
          }
        } catch {
          if (!cancelled) setError("Playback failed.");
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      if (current.source === "youtube") {
        const videoId = current.id.replace(/^youtube:/, "");
        if (isNativeAndroidPlayback() && window.SonoraNativeAudio?.play) {
          youtubePlayerRef.current?.stopVideo?.();
          setEngine("native");
          try {
            window.SonoraNativeAudio.play(
              toAbsoluteUrl(getYouTubeAudioProxyUrl(current, true)),
              current.title,
              current.artist,
              current.artwork,
              true,
              0,
              Math.round((current.duration || 0) * 1000),
            );
            if (!cancelled) {
              setIsPlaying(true);
              setError(null);
            }
          } catch (err) {
            console.error("YouTube audio proxy playback failed", err);
            if (!cancelled) {
              setIsPlaying(false);
              setError("YouTube playback failed. Try another source or downloaded track.");
            }
          } finally {
            if (!cancelled) setIsLoading(false);
          }
          return;
        }
        pendingYoutubeVideoIdRef.current = videoId;
        setEngine("youtube");
        ensureYoutubePlayer();
        youtubePlayerRef.current?.loadVideoById?.(videoId);
        return;
      }

      youtubePlayerRef.current?.stopVideo?.();
      const media = audioRef.current;
      if (!media) return;
      setEngine("audio");

      const url = current.streamUrl;
      if (cancelled) return;
      if (!url) {
        setIsLoading(false);
        setError("This track could not be played.");
        return;
      }
      if (isNativeAndroidPlayback() && window.SonoraNativeAudio?.play && /^https?:\/\//i.test(url)) {
        setEngine("native");
        try {
          window.SonoraNativeAudio.play(
            toAbsoluteUrl(url),
            current.title,
            current.artist,
            current.artwork,
            true,
            0,
            Math.round((current.duration || 0) * 1000),
          );
          if (!cancelled) {
            setIsPlaying(true);
            setError(null);
            setIsLoading(false);
          }
        } catch (err) {
          console.error("Native playback failed", err);
          if (!cancelled) {
            setIsPlaying(false);
            setError("Playback failed. Try another source or track.");
            setIsLoading(false);
          }
        }
        return;
      }
      media.src = url;
      try {
        await media.play();
        if (!cancelled) {
          setIsPlaying(true);
          setError(null);
        }
      } catch (err) {
        console.error("Audio playback failed", err);
        if (!cancelled) {
          setIsPlaying(false);
          setError("Playback failed. Try another source or track.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [current, playRequestId]);

  useEffect(() => {
    return () => revokeLocalObjectUrl();
  }, []);

  // Attach equalizer once media elements are mounted.
  useEffect(() => {
    if (audioRef.current) attachEqualizer(audioRef.current);
    if (videoRef.current) attachEqualizer(videoRef.current);
  }, []);

  // MediaSession: lock-screen / notification controls + keeps audio alive in background.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!current) {
      ms.metadata = null;
      try { ms.playbackState = "none"; } catch {}
      return;
    }
    ms.metadata = new window.MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: "Sonora",
      artwork: current.artwork
        ? [96, 192, 256, 384, 512].map((s) => ({
            src: current.artwork,
            sizes: `${s}x${s}`,
            type: "image/jpeg",
          }))
        : [],
    });
    try { ms.playbackState = isPlaying ? "playing" : "paused"; } catch {}
  }, [current, isPlaying]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const setAction = (action: MediaSessionAction, handler: any) => {
      try { ms.setActionHandler(action, handler); } catch {}
    };

    setAction("play", () => {
      if (!isPlaying) togglePlay();
    });
    setAction("pause", () => {
      if (isPlaying) togglePlay();
    });
    setAction("previoustrack", () => prev());
    setAction("nexttrack", () => next());
    setAction("seekto", (details: any) => {
      if (typeof details?.seekTime === "number") seek(details.seekTime);
    });
    setAction("seekforward", (details: any) => {
      const step = details?.seekOffset ?? 10;
      seek(Math.min((duration || 0), progress + step));
    });
    setAction("seekbackward", (details: any) => {
      const step = details?.seekOffset ?? 10;
      seek(Math.max(0, progress - step));
    });
    return () => {
      ["play","pause","previoustrack","nexttrack","seekto","seekforward","seekbackward"].forEach((a) => {
        try { ms.setActionHandler(a as MediaSessionAction, null); } catch {}
      });
    };
  }, [isPlaying, progress, duration]);

  // Update position state so scrubber works on lock screen.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms: any = navigator.mediaSession;
    if (!ms.setPositionState || !current) return;
    try {
      ms.setPositionState({
        duration: Math.max(0, duration || current.duration || 0),
        position: Math.max(0, Math.min(progress, duration || current.duration || 0)),
        playbackRate: 1,
      });
    } catch {}
  }, [progress, duration, current]);

  // Sync playback state to the native Android foreground service (notification + MediaSession).
  useEffect(() => {
    if (typeof window === "undefined" || !window.SonoraNativeAudio) return;
    try {
      if (!current) {
        window.SonoraNativeAudio.stop?.();
      } else if (playbackEngineRef.current !== "native") {
        window.SonoraNativeAudio.start?.(
          current.title,
          current.artist,
          current.artwork,
          isPlaying,
          Math.round((progress || 0) * 1000),
          Math.round((duration || current.duration || 0) * 1000),
        );
      }
    } catch {}
  }, [current, isPlaying, duration]);

  // Periodically push position to the native service so the lock-screen scrubber is accurate.
  useEffect(() => {
    if (typeof window === "undefined" || !window.SonoraNativeAudio) return;
    if (!current || !isPlaying) return;
    if (playbackEngineRef.current === "native") return;
    const t = window.setInterval(() => {
      try {
        window.SonoraNativeAudio?.start?.(
          current.title,
          current.artist,
          current.artwork,
          true,
          Math.round((progress || 0) * 1000),
          Math.round((duration || current.duration || 0) * 1000),
        );
      } catch {}
    }, 5000);
    return () => window.clearInterval(t);
  }, [current, isPlaying, progress, duration]);

  // Notification / lock-screen / Bluetooth button events from native bridge.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAction = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail || "";
      if (detail === "play" && !isPlaying) togglePlay();
      else if (detail === "pause" && isPlaying) togglePlay();
      else if (detail === "next") next();
      else if (detail === "prev") prev();
      else if (detail === "stop") {
        if (playbackEngineRef.current === "native") window.SonoraNativeAudio?.control?.("stop", 0);
        const media = getActiveMedia();
        media?.pause();
        youtubePlayerRef.current?.pauseVideo?.();
        setIsPlaying(false);
      } else if (detail.startsWith("seek:")) {
        const ms = Number(detail.slice(5));
        if (Number.isFinite(ms)) seek(ms / 1000);
      }
    };
    window.addEventListener("sonora:media-action", onAction as EventListener);
    return () => window.removeEventListener("sonora:media-action", onAction as EventListener);
  }, [isPlaying, current]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onNativeState = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        isPlaying?: boolean;
        positionMs?: number;
        durationMs?: number;
        status?: string;
      }>).detail;
      if (!detail || playbackEngineRef.current !== "native") return;
      if (typeof detail.positionMs === "number") setProgress(Math.max(0, detail.positionMs / 1000));
      if (typeof detail.durationMs === "number" && detail.durationMs > 0) setDuration(detail.durationMs / 1000);
      if (typeof detail.isPlaying === "boolean") setIsPlaying(detail.isPlaying);
      if (detail.status === "ready" || detail.status === "progress" || detail.status === "play") {
        setIsLoading(false);
        setError(null);
      } else if (detail.status === "buffering") {
        setIsLoading(true);
        setError(null);
      } else if (detail.status === "ended") {
        setIsPlaying(false);
        finishTrack();
      } else if (detail.status === "error") {
        setIsLoading(false);
        setIsPlaying(false);
        setError("Playback failed. Try another source or track.");
      }
    };
    window.addEventListener("sonora:native-state", onNativeState as EventListener);
    return () => window.removeEventListener("sonora:native-state", onNativeState as EventListener);
  }, [current, repeat, queue, shuffle]);







  const playTrack = (track: UnifiedTrack, newQueue?: UnifiedTrack[]) => {
    if (newQueue) setQueue(newQueue);
    else if (!queue.some((t) => t.id === track.id)) setQueue([track]);
    setCurrent(track);
    setPlayRequestId((id) => id + 1);
    setIsPlaying(true);
  };

  const addToQueue = (track: UnifiedTrack) => {
    setQueue((prev) =>
      prev.some((t) => t.id === track.id) ? prev : [...prev, track],
    );
  };

  const playNext = (track: UnifiedTrack) => {
    setQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      const idx = current ? filtered.findIndex((t) => t.id === current.id) : -1;
      const insertAt = idx >= 0 ? idx + 1 : 0;
      return [...filtered.slice(0, insertAt), track, ...filtered.slice(insertAt)];
    });
  };

  const removeFromQueue = (id: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== id));
  };

  const togglePlay = () => {
    if (playbackEngineRef.current === "native") {
      if (!current) return;
      if (isPlaying) {
        window.SonoraNativeAudio?.control?.("pause", 0);
        setIsPlaying(false);
      } else {
        window.SonoraNativeAudio?.control?.("play", 0);
        setIsPlaying(true);
      }
      return;
    }
    if (playbackEngineRef.current === "youtube") {
      const player = youtubePlayerRef.current;
      if (!player) return;
      if (isPlaying) {
        player.pauseVideo?.();
        setIsPlaying(false);
      } else {
        player.playVideo?.();
        setIsPlaying(true);
      }
      return;
    }
    const media = getActiveMedia();
    if (!media || !current) return;
    if (media.paused) {
      media.play().catch(() => {
        setIsPlaying(false);
        setError("Playback failed. Try another source or track.");
      });
      setIsPlaying(true);
    } else {
      media.pause();
      setIsPlaying(false);
    }
  };

  const currentIndex = current ? queue.findIndex((t) => t.id === current.id) : -1;

  const next = () => {
    if (queue.length === 0) return;
    if (shuffle) {
      const rand = Math.floor(Math.random() * queue.length);
      setCurrent(queue[rand]);
      return;
    }
    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) setCurrent(queue[nextIdx]);
    else if (repeat === "all") setCurrent(queue[0]);
  };

  const prev = () => {
    if (queue.length === 0) return;
    const prevIdx = currentIndex - 1;
    if (prevIdx >= 0) setCurrent(queue[prevIdx]);
  };

  const seek = (seconds: number) => {
    if (playbackEngineRef.current === "native") {
      window.SonoraNativeAudio?.control?.("seek", Math.round(seconds * 1000));
      setProgress(seconds);
      return;
    }
    if (playbackEngineRef.current === "youtube") {
      youtubePlayerRef.current?.seekTo?.(seconds, true);
      setProgress(seconds);
      return;
    }
    const media = getActiveMedia();
    if (media) media.currentTime = seconds;
    setProgress(seconds);
  };

  const setVolume = (v: number) => setVolumeState(Math.max(0, Math.min(1, v)));
  const toggleShuffle = () => setShuffle((s) => !s);
  const cycleRepeat = () =>
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));

  const mediaHandlers = {
    onTimeUpdate: (e: SyntheticEvent<HTMLMediaElement>) =>
      e.currentTarget === getActiveMedia() && setProgress(e.currentTarget.currentTime),
    onLoadedMetadata: (e: SyntheticEvent<HTMLMediaElement>) =>
      e.currentTarget === getActiveMedia() &&
      setDuration(usableDuration(e.currentTarget.duration, current?.duration ?? 0)),
    onCanPlay: (e: SyntheticEvent<HTMLMediaElement>) => {
      if (e.currentTarget === getActiveMedia()) setIsLoading(false);
    },
    onError: (e: SyntheticEvent<HTMLMediaElement>) => {
      if (e.currentTarget !== getActiveMedia()) return;
      setIsLoading(false);
      setIsPlaying(false);
      setError("Playback failed. Try another source or track.");
    },
    onEnded: (e: SyntheticEvent<HTMLMediaElement>) => {
      if (e.currentTarget !== getActiveMedia()) return;
      finishTrack();
    },
  };

  return (
    <PlayerContext.Provider
      value={{
        audioRef,
        current,
        queue,
        isPlaying,
        progress,
        duration,
        volume,
        shuffle,
        repeat,
        isLoading,
        error,
        playTrack,
        addToQueue,
        playNext,
        removeFromQueue,
        togglePlay,
        next,
        prev,
        seek,
        setVolume,
        toggleShuffle,
        cycleRepeat,
      }}
    >
      {children}
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" {...mediaHandlers} />
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        className="hidden"
        {...mediaHandlers}
      />
      <div
        ref={youtubeContainerRef}
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-0 h-px w-px opacity-0"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
