import { createFileRoute } from "@tanstack/react-router";
import { Sliders } from "lucide-react";
import { EQ_BANDS, EQ_PRESETS, useEqSettings } from "@/lib/equalizer";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/equalizer")({
  head: () => ({ meta: [{ title: "Equalizer — Sonora" }] }),
  component: EqualizerPage,
});

function EqualizerPage() {
  const [settings, update] = useEqSettings();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Sliders className="h-7 w-7 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Equalizer</h1>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-lg bg-card p-4">
        <div>
          <p className="font-semibold">Enable Equalizer</p>
          <p className="text-xs text-muted-foreground">
            Applies a Web Audio EQ to Jamendo/Audius/Deezer/downloaded tracks.
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(v) => update({ ...settings, enabled: v })}
        />
      </div>

      <div className="rounded-lg bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Presets</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EQ_PRESETS).map(([name, gains]) => (
            <button
              key={name}
              onClick={() => update({ ...settings, gains })}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:bg-secondary"
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-card p-4">
        <div className="grid grid-cols-6 gap-3">
          {EQ_BANDS.map((freq, i) => (
            <div key={freq} className="flex flex-col items-center gap-2">
              <span className="text-xs tabular-nums text-primary">
                {settings.gains[i] > 0 ? "+" : ""}
                {settings.gains[i]?.toFixed(0) ?? 0} dB
              </span>
              <div className="h-40 flex items-center">
                <Slider
                  orientation="vertical"
                  value={[settings.gains[i] ?? 0]}
                  min={-12}
                  max={12}
                  step={1}
                  onValueChange={(v) => {
                    const gains = [...settings.gains];
                    gains[i] = v[0] ?? 0;
                    update({ ...settings, gains });
                  }}
                  className="h-full"
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {freq >= 1000 ? `${freq / 1000}k` : freq}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
