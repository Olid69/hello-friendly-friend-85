import { createFileRoute } from "@tanstack/react-router";
import { Sliders, RotateCcw, Power } from "lucide-react";
import { useMemo } from "react";
import {
  EQ_BANDS,
  EQ_BAND_COUNT,
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  EQ_PREAMP_MAX,
  EQ_PREAMP_MIN,
  EQ_PRESETS,
  useEqSettings,
} from "@/lib/equalizer";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/equalizer")({
  head: () => ({
    meta: [
      { title: "Equalizer — Sonora" },
      {
        name: "description",
        content:
          "10-band graphic equalizer with presets, preamp and live curve visualization.",
      },
    ],
  }),
  component: EqualizerPage,
});

function formatFreq(hz: number) {
  return hz >= 1000 ? `${hz / 1000}k` : `${hz}`;
}

function activePresetName(gains: number[]): string | null {
  for (const [name, preset] of Object.entries(EQ_PRESETS)) {
    if (preset.every((g, i) => g === gains[i])) return name;
  }
  return null;
}

function EqCurve({ gains, enabled }: { gains: number[]; enabled: boolean }) {
  const width = 320;
  const height = 90;
  const midY = height / 2;
  const points = useMemo(() => {
    return gains.map((g, i) => {
      const x = (i / (EQ_BAND_COUNT - 1)) * width;
      const y = midY - (g / EQ_GAIN_MAX) * (midY - 8);
      return [x, y] as const;
    });
  }, [gains]);

  // Catmull-Rom to Bezier smoothing
  const path = useMemo(() => {
    if (points.length === 0) return "";
    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
  }, [points]);

  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn(
        "w-full h-24 transition-opacity",
        enabled ? "opacity-100" : "opacity-40"
      )}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line
        x1="0"
        y1={midY}
        x2={width}
        y2={midY}
        stroke="hsl(var(--border))"
        strokeDasharray="3 4"
      />
      <path d={areaPath} fill="url(#eq-fill)" />
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="hsl(var(--primary))" />
      ))}
    </svg>
  );
}

function EqualizerPage() {
  const [settings, update] = useEqSettings();
  const activePreset = activePresetName(settings.gains);

  const setGain = (i: number, v: number) => {
    const gains = [...settings.gains];
    gains[i] = v;
    update({ ...settings, gains, enabled: true });
  };

  const applyPreset = (gains: number[]) => {
    update({ ...settings, gains: [...gains], enabled: true });
  };

  const reset = () => {
    update({
      enabled: settings.enabled,
      preamp: 0,
      gains: Array(EQ_BAND_COUNT).fill(0),
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 pb-32">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              Equalizer
            </h1>
            <p className="text-xs text-muted-foreground">
              10-band graphic EQ · {activePreset ? `${activePreset} preset` : "Custom"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5">
          <Power
            className={cn(
              "h-4 w-4 transition-colors",
              settings.enabled ? "text-primary" : "text-muted-foreground"
            )}
          />
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => update({ ...settings, enabled: v })}
          />
        </div>
      </div>

      {/* Curve visualization */}
      <div className="mb-4 rounded-xl bg-card p-4">
        <EqCurve gains={settings.gains} enabled={settings.enabled} />
      </div>

      {/* Sliders */}
      <div className="rounded-xl bg-card p-4">
        <div className="grid grid-cols-10 gap-1 md:gap-2">
          {EQ_BANDS.map((freq, i) => {
            const val = settings.gains[i] ?? 0;
            return (
              <div key={freq} className="flex flex-col items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] md:text-xs tabular-nums font-mono",
                    val === 0
                      ? "text-muted-foreground"
                      : val > 0
                      ? "text-primary"
                      : "text-orange-400"
                  )}
                >
                  {val > 0 ? "+" : ""}
                  {val.toFixed(0)}
                </span>
                <div className="h-44 flex items-center">
                  <Slider
                    orientation="vertical"
                    value={[val]}
                    min={EQ_GAIN_MIN}
                    max={EQ_GAIN_MAX}
                    step={1}
                    onValueChange={(v) => setGain(i, v[0] ?? 0)}
                    className="h-full"
                    disabled={!settings.enabled}
                  />
                </div>
                <span className="text-[9px] md:text-[10px] text-muted-foreground">
                  {formatFreq(freq)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[10px] text-muted-foreground px-1">
          <span>{EQ_GAIN_MIN} dB</span>
          <span>0 dB</span>
          <span>+{EQ_GAIN_MAX} dB</span>
        </div>
      </div>

      {/* Preamp */}
      <div className="mt-4 rounded-xl bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Preamp</p>
          <span className="text-xs font-mono tabular-nums text-primary">
            {settings.preamp > 0 ? "+" : ""}
            {settings.preamp.toFixed(0)} dB
          </span>
        </div>
        <Slider
          value={[settings.preamp]}
          min={EQ_PREAMP_MIN}
          max={EQ_PREAMP_MAX}
          step={1}
          onValueChange={(v) =>
            update({ ...settings, preamp: v[0] ?? 0, enabled: true })
          }
          disabled={!settings.enabled}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Reduce preamp if boosted bands cause distortion or clipping.
        </p>
      </div>

      {/* Presets */}
      <div className="mt-4 rounded-xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Presets</p>
          <Button size="sm" variant="ghost" onClick={reset} className="h-7 gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EQ_PRESETS).map(([name, gains]) => {
            const isActive = activePreset === name;
            return (
              <button
                key={name}
                onClick={() => applyPreset(gains)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background hover:bg-secondary"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Applies to Jamendo, Audius, Deezer, FMA & downloaded tracks. YouTube
        streams may bypass EQ due to CORS.
      </p>
    </div>
  );
}
