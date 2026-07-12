import { useEffect, useState } from "react";

// 10-band ISO-standard graphic EQ frequencies (Hz).
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_BAND_COUNT = EQ_BANDS.length;
export const EQ_GAIN_MIN = -12;
export const EQ_GAIN_MAX = 12;
export const EQ_PREAMP_MIN = -12;
export const EQ_PREAMP_MAX = 12;

export type EqSettings = {
  enabled: boolean;
  preamp: number;
  gains: number[];
};

const KEY = "sonora.eq.v2";

const zeros = () => Array(EQ_BAND_COUNT).fill(0);

export const EQ_PRESETS: Record<string, number[]> = {
  Flat:        [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  "Bass Boost":[ 7,  6,  5,  3,  1,  0,  0,  0,  0,  0],
  "Bass Cut":  [-7, -6, -5, -3, -1,  0,  0,  0,  0,  0],
  Vocal:       [-2, -3, -3,  1,  4,  4,  3,  1, -1, -2],
  Treble:      [ 0,  0,  0,  0,  0,  1,  3,  5,  6,  7],
  "Treble Cut":[ 0,  0,  0,  0,  0, -1, -3, -5, -6, -7],
  Rock:        [ 5,  4,  3, -1, -2, -1,  2,  4,  5,  5],
  Pop:         [-1,  1,  3,  4,  4,  3,  1,  0, -1, -2],
  Jazz:        [ 3,  2,  1,  2, -1, -1,  0,  1,  2,  3],
  Classical:   [ 4,  3,  2,  1, -1, -1,  0,  2,  3,  4],
  Electronic:  [ 5,  4,  1,  0, -2,  1,  1,  2,  4,  5],
  "Hip-Hop":   [ 5,  4,  2,  3, -1, -1,  1, -1,  2,  3],
  Dance:       [ 6,  5,  2,  0, -1, -2,  0,  3,  4,  4],
  Acoustic:    [ 4,  4,  3,  1,  2,  2,  3,  3,  2,  1],
  "Loudness":  [ 6,  4,  0,  0, -2,  0,  0,  1,  4,  6],
};

function migrateGains(gains: unknown): number[] {
  if (!Array.isArray(gains)) return zeros();
  const out = zeros();
  const n = Math.min(gains.length, EQ_BAND_COUNT);
  for (let i = 0; i < n; i++) {
    const v = Number(gains[i]);
    out[i] = Number.isFinite(v) ? Math.max(EQ_GAIN_MIN, Math.min(EQ_GAIN_MAX, v)) : 0;
  }
  return out;
}

export function readEq(): EqSettings {
  if (typeof window === "undefined")
    return { enabled: false, preamp: 0, gains: zeros() };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        preamp: Number.isFinite(parsed.preamp) ? parsed.preamp : 0,
        gains: migrateGains(parsed.gains),
      };
    }
    // Migrate v1
    const old = window.localStorage.getItem("sonora.eq");
    if (old) {
      const parsed = JSON.parse(old);
      return {
        enabled: Boolean(parsed.enabled),
        preamp: 0,
        gains: migrateGains(parsed.gains),
      };
    }
  } catch {}
  return { enabled: false, preamp: 0, gains: zeros() };
}

export function writeEq(settings: EqSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("sonora:eq", { detail: settings }));
}

export function useEqSettings() {
  const [settings, setSettings] = useState<EqSettings>({
    enabled: false,
    preamp: 0,
    gains: zeros(),
  });
  useEffect(() => {
    setSettings(readEq());
    const h = (e: Event) => setSettings((e as CustomEvent).detail);
    window.addEventListener("sonora:eq", h);
    return () => window.removeEventListener("sonora:eq", h);
  }, []);
  const update = (next: EqSettings) => {
    setSettings(next);
    writeEq(next);
  };
  return [settings, update] as const;
}

// Attach an equalizer graph to an HTMLMediaElement.
export type EqController = {
  setGains: (gains: number[]) => void;
  setPreamp: (db: number) => void;
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
};

const attached = new WeakMap<HTMLMediaElement, EqController>();

// dB -> linear gain
const dbToGain = (db: number) => Math.pow(10, db / 20);

export function attachEqualizer(media: HTMLMediaElement): EqController | null {
  if (typeof window === "undefined") return null;
  const existing = attached.get(media);
  if (existing) return existing;
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(media);

    const preampNode = ctx.createGain();
    preampNode.gain.value = 1;

    const filters = EQ_BANDS.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      if (i === 0) f.type = "lowshelf";
      else if (i === EQ_BANDS.length - 1) f.type = "highshelf";
      else f.type = "peaking";
      f.frequency.value = freq;
      f.Q.value = 1.1;
      f.gain.value = 0;
      return f;
    });

    // source -> preamp -> filters chain -> destination
    source.connect(preampNode);
    preampNode.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++)
      filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(ctx.destination);

    let enabled = false;
    let currentGains: number[] = zeros();
    let currentPreamp = 0;

    const applyFilters = () => {
      filters.forEach((f, i) => {
        const g = enabled ? currentGains[i] ?? 0 : 0;
        f.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
      });
      const preLinear = enabled ? dbToGain(currentPreamp) : 1;
      preampNode.gain.setTargetAtTime(preLinear, ctx.currentTime, 0.02);
    };

    const controller: EqController = {
      setGains: (gains: number[]) => {
        currentGains = gains.slice(0, EQ_BAND_COUNT);
        applyFilters();
      },
      setPreamp: (db: number) => {
        currentPreamp = db;
        applyFilters();
      },
      setEnabled: (v: boolean) => {
        enabled = v;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        applyFilters();
      },
      destroy: () => {
        try { ctx.close(); } catch {}
        attached.delete(media);
      },
    };
    attached.set(media, controller);

    // Apply persisted settings.
    const s = readEq();
    controller.setPreamp(s.preamp);
    controller.setGains(s.gains);
    controller.setEnabled(s.enabled);

    window.addEventListener("sonora:eq", (e: Event) => {
      const next = (e as CustomEvent).detail as EqSettings;
      controller.setPreamp(next.preamp);
      controller.setGains(next.gains);
      controller.setEnabled(next.enabled);
    });

    // Resume audio ctx on first user gesture.
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });

    return controller;
  } catch {
    return null;
  }
}
