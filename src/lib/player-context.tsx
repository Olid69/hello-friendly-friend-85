import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  const [current, setCurrent] = useState<UnifiedTrack | null>(null);
  const [queue, setQueue] = useState<UnifiedTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  const playTrack = (track: UnifiedTrack, newQueue?: UnifiedTrack[]) => {
    setCurrent(track);
    if (newQueue) setQueue(newQueue);
    setIsPlaying(true);
    // Audio load/play will be wired in Phase 2 when adapters exist.
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
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
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
    setProgress(seconds);
  };

  const setVolume = (v: number) => setVolumeState(Math.max(0, Math.min(1, v)));
  const toggleShuffle = () => setShuffle((s) => !s);
  const cycleRepeat = () =>
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));

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
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          if (repeat === "one" && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } else {
            next();
          }
        }}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
