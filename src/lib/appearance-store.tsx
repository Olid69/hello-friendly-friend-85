import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Material 3 accent seed + contrast controls.
 * Writes CSS variables --seed-h / --seed-c on <html> so the whole app re-tints.
 */

export type SeedName =
  | "red"
  | "green"
  | "blue"
  | "purple"
  | "coral"
  | "amber"
  | "rose"
  | "teal"
  | "violet";

export const SEEDS: { name: SeedName; label: string; hue: number; chroma: number; swatch: string }[] = [
  { name: "red",    label: "Crimson", hue: 15,  chroma: 0.22, swatch: "oklch(0.62 0.22 15)"  },
  { name: "green",  label: "Emerald", hue: 148, chroma: 0.19, swatch: "oklch(0.78 0.19 148)" },
  { name: "blue",   label: "Ocean",   hue: 235, chroma: 0.17, swatch: "oklch(0.72 0.17 235)" },
  { name: "purple", label: "Amethyst",hue: 295, chroma: 0.18, swatch: "oklch(0.72 0.18 295)" },
  { name: "coral",  label: "Coral",   hue: 25,  chroma: 0.18, swatch: "oklch(0.75 0.18 25)"  },
  { name: "amber",  label: "Sunset",  hue: 65,  chroma: 0.17, swatch: "oklch(0.82 0.17 65)"  },
  { name: "rose",   label: "Rose",    hue: 355, chroma: 0.19, swatch: "oklch(0.73 0.19 355)" },
  { name: "teal",   label: "Aqua",    hue: 195, chroma: 0.15, swatch: "oklch(0.78 0.15 195)" },
  { name: "violet", label: "Violet",  hue: 275, chroma: 0.19, swatch: "oklch(0.72 0.19 275)" },
];

export type ContrastLevel = "standard" | "medium" | "high";
export type RadiusLevel = "cozy" | "expressive" | "rounded";

interface AppearanceState {
  seed: SeedName;
  contrast: ContrastLevel;
  radius: RadiusLevel;
  setSeed: (s: SeedName) => void;
  setContrast: (c: ContrastLevel) => void;
  setRadius: (r: RadiusLevel) => void;
}

const KEY = "sonora:appearance";
const Ctx = createContext<AppearanceState | null>(null);

function apply(seed: SeedName, contrast: ContrastLevel, radius: RadiusLevel) {
  if (typeof document === "undefined") return;
  const s = SEEDS.find((x) => x.name === seed) ?? SEEDS[0];
  const root = document.documentElement;
  root.style.setProperty("--seed-h", String(s.hue));
  const chromaMul = contrast === "high" ? 1.15 : contrast === "medium" ? 1.05 : 1;
  root.style.setProperty("--seed-c", (s.chroma * chromaMul).toFixed(3));
  const radiusValue = radius === "cozy" ? "12px" : radius === "rounded" ? "22px" : "16px";
  root.style.setProperty("--radius", radiusValue);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [seed, setSeedState] = useState<SeedName>("green");
  const [contrast, setContrastState] = useState<ContrastLevel>("standard");
  const [radius, setRadiusState] = useState<RadiusLevel>("expressive");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.seed) setSeedState(p.seed);
        if (p.contrast) setContrastState(p.contrast);
        if (p.radius) setRadiusState(p.radius);
        apply(p.seed ?? "green", p.contrast ?? "standard", p.radius ?? "expressive");
      }
    } catch {}
  }, []);

  useEffect(() => {
    apply(seed, contrast, radius);
    try { localStorage.setItem(KEY, JSON.stringify({ seed, contrast, radius })); } catch {}
  }, [seed, contrast, radius]);

  return (
    <Ctx.Provider
      value={{
        seed, contrast, radius,
        setSeed: setSeedState,
        setContrast: setContrastState,
        setRadius: setRadiusState,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
