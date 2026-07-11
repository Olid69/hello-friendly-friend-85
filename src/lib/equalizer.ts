import { useEffect, useState } from "react";

export const EQ_BANDS = [60, 170, 350, 1000, 3500, 10000] as const;
export type EqSettings = { enabled: boolean; gains: number[] };

const KEY = "sonora.eq";

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0],
  Bass: [6, 4, 2, 0, 0, 0],
  Vocal: [-2, -1, 0, 3, 4, 2],
  Treble: [0, 0, 0, 2, 4, 6],
  Rock: [4, 3, -1, -2, 2, 4],
  Electronic: [4, 2, 0, -1, 2, 5],
};

export function readEq(): EqSettings {
  if (typeof window === "undefined")
    return { enabled: false, gains: [0, 0, 0, 0, 0, 0] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: false, gains: [0, 0, 0, 0, 0, 0] };
}

export function writeEq(settings: EqSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("sonora:eq", { detail: settings }));
}

export function useEqSettings() {
  const [settings, setSettings] = useState<EqSettings>({
    enabled: false,
    gains: [0, 0, 0, 0, 0, 0],
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
  setEnabled: (enabled: boolean) => void;
  destroy: () => void;
};

const attached = new WeakMap<HTMLMediaElement, EqController>();

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
    const filters = EQ_BANDS.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type =
        i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
      f.frequency.value = freq;
      f.Q.value = 1;
      f.gain.value = 0;
      return f;
    });
    const bypass = ctx.createGain();
    bypass.gain.value = 1;
    // Chain filters
    source.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
    filters[filters.length - 1].connect(bypass);
    bypass.connect(ctx.destination);

    let enabled = false;
    const setGains = (gains: number[]) => {
      filters.forEach((f, i) => {
        f.gain.value = enabled ? gains[i] ?? 0 : 0;
      });
    };
    const controller: EqController = {
      setGains,
      setEnabled: (v: boolean) => {
        enabled = v;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
      },
      destroy: () => {
        try {
          ctx.close();
        } catch {}
        attached.delete(media);
      },
    };
    attached.set(media, controller);

    // Apply persisted settings.
    const s = readEq();
    controller.setEnabled(s.enabled);
    controller.setGains(s.gains);
    window.addEventListener("sonora:eq", (e: Event) => {
      const next = (e as CustomEvent).detail as EqSettings;
      controller.setEnabled(next.enabled);
      controller.setGains(next.gains);
    });
    return controller;
  } catch {
    return null;
  }
}
