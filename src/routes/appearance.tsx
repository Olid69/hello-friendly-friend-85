import { createFileRoute } from "@tanstack/react-router";
import { useAppearance, SEEDS, type ContrastLevel, type RadiusLevel } from "@/lib/appearance-store";
import { Check, Palette, Contrast, Radius } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/appearance")({
  head: () => ({
    meta: [
      { title: "Appearance — Sonora" },
      { name: "description", content: "Customize your Material You accent, contrast, and shape." },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  const { seed, setSeed, contrast, setContrast, radius, setRadius } = useAppearance();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pt-10">
      <header className="mb-8">
        <h1 className="md-headline-lg text-foreground">Appearance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Material You — tune the entire app to your taste.
        </p>
      </header>

      <Section icon={<Palette className="h-5 w-5" />} title="Accent color" hint="Recolors buttons, controls, and highlights.">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {SEEDS.map((s) => {
            const active = seed === s.name;
            return (
              <button
                key={s.name}
                onClick={() => setSeed(s.name)}
                className={cn(
                  "md-interactive group relative flex aspect-square items-center justify-center rounded-2xl shadow-md transition-transform",
                  active && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                )}
                style={{ background: s.swatch }}
                aria-label={s.label}
                title={s.label}
              >
                {active && <Check className="h-5 w-5 text-black/80" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </Section>

      <Section icon={<Contrast className="h-5 w-5" />} title="Contrast" hint="Boost color saturation for more punch.">
        <SegmentedControl<ContrastLevel>
          value={contrast}
          onChange={setContrast}
          options={[
            { value: "standard", label: "Standard" },
            { value: "medium",   label: "Medium" },
            { value: "high",     label: "High" },
          ]}
        />
      </Section>

      <Section icon={<Radius className="h-5 w-5" />} title="Shape" hint="Corner roundness across cards and controls.">
        <SegmentedControl<RadiusLevel>
          value={radius}
          onChange={setRadius}
          options={[
            { value: "cozy",       label: "Cozy" },
            { value: "expressive", label: "Expressive" },
            { value: "rounded",    label: "Rounded" },
          ]}
        />
      </Section>

      <Section title="Preview" hint="Live sample of the current theme.">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md-elevation-2 rounded-[var(--radius)] p-5">
            <p className="md-title-lg mb-1 text-foreground">Now Playing</p>
            <p className="text-sm text-muted-foreground">Your accent brings the vibe.</p>
            <div className="mt-4 flex gap-2">
              <button className="md-interactive rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30">
                Play
              </button>
              <button className="md-interactive rounded-full bg-secondary-container px-5 py-2 text-sm font-medium text-on-secondary-container">
                Add to queue
              </button>
              <button className="md-interactive rounded-full border border-outline px-5 py-2 text-sm font-medium text-foreground">
                Share
              </button>
            </div>
          </div>
          <div className="md-elevation-1 rounded-[var(--radius)] p-5">
            <div className="mb-3 flex flex-wrap gap-2">
              {["Rock", "Bangla", "Chill", "2025"].map((c) => (
                <span key={c} className="rounded-full bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container">
                  {c}
                </span>
              ))}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">2:14 / 3:22</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="md-title-lg text-foreground">{title}</h2>
      </div>
      {hint && <p className="mb-4 text-sm text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border border-outline bg-surface-container p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "md-interactive rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary-container text-on-secondary-container"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
