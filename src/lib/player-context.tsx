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
  }
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeContainerRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const pendingYoutubeVideoIdRef = useRef<string | null>(null);
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

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
    youtubePlayerRef.current?.setVolume?.(Math.round(volume * 100));
  }, [volume]);

  const getActiveMedia = () =>
    current?.source === "youtube" ? videoRef.current : audioRef.current;

  const resetMedia = (media: HTMLMediaElement | null) => {
    if (!media) return;
    media.pause();
    media.removeAttribute("src");
    media.load();
  };

  const finishTrack = () => {
    const media = getActiveMedia();
    if (repeat === "one" && media) {
      media.currentTime = 0;
      media.play().catch(() => {});
    } else if (repeat === "one" && current?.source === "youtube") {
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
    if (current?.source !== "youtube") return;
    const timer = window.setInterval(() => {
      const player = youtubePlayerRef.current;
      if (!player?.getCurrentTime) return;
      setProgress(player.getCurrentTime() || 0);
      setDuration(player.getDuration?.() || current.duration || 0);
    }, 500);
    return () => window.clearInterval(timer);
  }, [current]);

  // Load stream when current changes (resolves YouTube via Piped on demand).
  useEffect(() => {
    if (!current) return;
    let cancelled = false;

    // Track recent plays (persist to localStorage).
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("sonora.recent");
        const prev = raw ? (JSON.parse(raw) as UnifiedTrack[]) : [];
        const next = [current, ...prev.filter((t) => t.id !== current.id)].slice(0, 50);
        window.localStorage.setItem("sonora.recent", JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("sonora:store", { detail: "sonora.recent" }));
      } catch {}
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      setProgress(0);
      setDuration(current.duration || 0);
      resetMedia(audioRef.current);
      resetMedia(videoRef.current);

      // Try local download first for any source.
      let localUrl: string | null = null;
      try {
        localUrl = await getDownloadBlobUrl(current.id);
      } catch {}
      if (cancelled) return;

      if (localUrl) {
        youtubePlayerRef.current?.stopVideo?.();
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
        pendingYoutubeVideoIdRef.current = videoId;
        ensureYoutubePlayer();
        youtubePlayerRef.current?.loadVideoById?.(videoId);
        return;
      }

      youtubePlayerRef.current?.stopVideo?.();
      const media = audioRef.current;
      if (!media) return;

      const url = current.streamUrl;
      if (cancelled) return;
      if (!url) {
        setIsLoading(false);
        setError("This track could not be played.");
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

  // Attach equalizer once media elements are mounted.
  useEffect(() => {
    if (audioRef.current) attachEqualizer(audioRef.current);
    if (videoRef.current) attachEqualizer(videoRef.current);
  }, []);



  const playTrack = (track: UnifiedTrack, newQueue?: UnifiedTrack[]) => {
    if (newQueue) setQueue(newQueue);
    else if (!queue.some((t) => t.id === track.id)) setQueue([track]);
    setCurrent(track);
    setPlayRequestId((id) => id + 1);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (current?.source === "youtube") {
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
    if (current?.source === "youtube") {
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
      setProgress(e.currentTarget.currentTime),
    onLoadedMetadata: (e: SyntheticEvent<HTMLMediaElement>) =>
      setDuration(e.currentTarget.duration),
    onCanPlay: () => setIsLoading(false),
    onError: () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError("Playback failed. Try another source or track.");
    },
    onEnded: () => {
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
      <audio ref={audioRef} preload="metadata" {...mediaHandlers} />
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
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
