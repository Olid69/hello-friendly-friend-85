// Lightweight haptics helper — uses Capacitor Haptics on native, falls back to
// navigator.vibrate on web. Never throws. Silent no-op if unavailable.

type Style = "light" | "medium" | "heavy" | "selection";

let capHaptics: {
  impact?: (opts: { style: string }) => Promise<void>;
  selectionStart?: () => Promise<void>;
} | null = null;
let capLoaded = false;

async function loadCap() {
  if (capLoaded) return;
  capLoaded = true;
  try {
    // Only try native import when Capacitor is present.
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    if (!w?.Capacitor?.isNativePlatform?.()) return;
    const mod: any = await import(
      /* @vite-ignore */ `${"@capacitor"}/haptics`
    ).catch(() => null);
    if (mod?.Haptics) capHaptics = mod.Haptics;
  } catch {
    /* ignore */
  }
}

export function haptic(style: Style = "light") {
  if (typeof window === "undefined") return;
  // Fire-and-forget native path
  loadCap().then(() => {
    try {
      if (capHaptics?.impact && style !== "selection") {
        const map: Record<string, string> = {
          light: "LIGHT",
          medium: "MEDIUM",
          heavy: "HEAVY",
        };
        capHaptics.impact({ style: map[style] ?? "LIGHT" });
        return;
      }
      if (capHaptics?.selectionStart && style === "selection") {
        capHaptics.selectionStart();
        return;
      }
    } catch {
      /* ignore */
    }
    // Web fallback
    try {
      const nav: any = navigator;
      if (typeof nav.vibrate === "function") {
        const dur = style === "heavy" ? 22 : style === "medium" ? 14 : 8;
        nav.vibrate(dur);
      }
    } catch {
      /* ignore */
    }
  });
}
