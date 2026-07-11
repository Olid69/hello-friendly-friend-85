import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { resolveYoutubeStream } from "./music-sources.functions";

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

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
  }, [volume]);

  const getActiveMedia = () =>
    current?.source === "youtube" ? videoRef.current : audioRef.current;

  const resetMedia = (media: HTMLMediaElement | null) => {
    if (!media) return;
    media.pause();
    media.removeAttribute("src");
    media.load();
  };

  // Load stream when current changes (resolves YouTube via Piped on demand).
  useEffect(() => {
    const media = getActiveMedia();
    if (!media || !current) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setIsPlaying(false);
      resetMedia(audioRef.current);
      resetMedia(videoRef.current);

      let url = current.streamUrl;
      if (!url && current.source === "youtube") {
        try {
          const videoId = current.id.replace(/^youtube:/, "");
          const res = await resolveYoutubeStream({ data: { videoId } });
          url = res.streamUrl ?? undefined;
        } catch (err) {
          console.error("YouTube stream resolution failed", err);
        }
      }
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

  const playTrack = (track: UnifiedTrack, newQueue?: UnifiedTrack[]) => {
    if (newQueue) setQueue(newQueue);
    else if (!queue.some((t) => t.id === track.id)) setQueue([track]);
    setCurrent(track);
    setPlayRequestId((id) => id + 1);
    setIsPlaying(true);
  };

  const togglePlay = () => {
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
      const media = getActiveMedia();
      if (repeat === "one" && media) {
        media.currentTime = 0;
        media.play().catch(() => {});
      } else {
        next();
      }
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
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
