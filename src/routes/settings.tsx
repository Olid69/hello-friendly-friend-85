import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings as SettingsIcon,
  Server,
  Info,
  Sliders,
  Download,
  Mic2,
  Smartphone,
  Zap,
  Palette,
  Languages,
  HardDrive,
  User,
  LogOut,
  LogIn,
  Shield,
  FileText,
  Mail,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useDataSaver } from "@/lib/data-saver";
import { useT, type Language } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import {
  clearImageCache,
  clearTemporaryFiles,
  formatBytes,
  getStorageEstimate,
  type StorageEstimateInfo,
} from "@/lib/cache-utils";

const APP_VERSION = "1.3.0";
const SUPPORT_EMAIL = "support@sonora-stream.lovable.app";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Sonora" }] }),
  component: SettingsPage,
});

const tools = [
  { to: "/equalizer", label: "Equalizer", icon: Sliders, desc: "6-band Web Audio EQ" },
  { to: "/downloads", label: "Downloads", icon: Download, desc: "Offline library (IndexedDB)" },
  { to: "/lyrics", label: "Lyrics", icon: Mic2, desc: "Synced lyrics via LRCLIB" },
] as const;

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-xl bg-card p-5 ring-1 ring-border/40">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SegmentedButton<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg bg-muted p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type ThemeMode = "dark" | "light" | "system";
const THEME_KEY = "sonora.theme";

function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY) as ThemeMode | null;
      if (saved === "dark" || saved === "light" || saved === "system") setMode(saved);
    } catch {}
  }, []);

  const apply = useCallback((next: ThemeMode) => {
    setMode(next);
    try { window.localStorage.setItem(THEME_KEY, next); } catch {}
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
    const wantDark = next === "dark" || (next === "system" && prefersDark);
    root.classList.toggle("dark", wantDark);
  }, []);

  return { mode, setMode: apply };
}

function SettingsPage() {
  const { dataSaver, toggle } = useDataSaver();
  const { lang, setLang, t } = useT();
  const { user, signOut } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);
  const [clearing, setClearing] = useState<"images" | "temp" | null>(null);

  const refreshStorage = useCallback(() => {
    getStorageEstimate().then(setStorage).catch(() => setStorage(null));
  }, []);
  useEffect(() => { refreshStorage(); }, [refreshStorage]);

  const handleClearImages = async () => {
    if (clearing) return;
    setClearing("images");
    try {
      const cleared = await clearImageCache();
      toast.success(`${t("settings.storage.cleared")} — ${cleared} caches`);
    } catch {
      toast.error("Failed");
    } finally {
      setClearing(null);
      refreshStorage();
    }
  };

  const handleClearTemp = async () => {
    if (clearing) return;
    setClearing("temp");
    try {
      const cleared = clearTemporaryFiles();
      toast.success(`${t("settings.storage.cleared")} — ${cleared} items`);
    } catch {
      toast.error("Failed");
    } finally {
      setClearing(null);
      refreshStorage();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success(t("settings.account.signOut"));
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-2xl md:text-3xl font-bold">{t("settings.title")}</h1>
      </div>

      {/* Appearance / Theme */}
      <Section icon={<Palette className="h-5 w-5" />} title={t("settings.appearance")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("settings.theme")}</p>
          <SegmentedButton<ThemeMode>
            value={themeMode}
            ariaLabel={t("settings.theme")}
            onChange={setThemeMode}
            options={[
              { value: "dark", label: t("settings.theme.dark") },
              { value: "light", label: t("settings.theme.light") },
              { value: "system", label: t("settings.theme.system") },
            ]}
          />
        </div>
      </Section>

      {/* Language */}
      <Section icon={<Languages className="h-5 w-5" />} title={t("settings.language")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{t("settings.language")}</p>
          <SegmentedButton<Language>
            value={lang}
            ariaLabel={t("settings.language")}
            onChange={setLang}
            options={[
              { value: "en", label: t("settings.language.english") },
              { value: "bn", label: t("settings.language.bangla") },
            ]}
          />
        </div>
      </Section>

      {/* Data saver (existing) */}
      <Section icon={<Zap className="h-5 w-5" />} title={t("settings.dataSaver")}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">{t("settings.dataSaver.desc")}</p>
          <button
            onClick={toggle}
            role="switch"
            aria-checked={dataSaver}
            aria-label={t("settings.dataSaver")}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${dataSaver ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${dataSaver ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      </Section>

      {/* Account */}
      <Section icon={<User className="h-5 w-5" />} title={t("settings.account")}>
        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("settings.account.signedInAs")}</p>
              <p className="truncate text-sm font-medium">{user.email ?? user.id}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-secondary"
            >
              <LogOut className="h-4 w-4" />
              {t("settings.account.signOut")}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("settings.account.signedOut")}</p>
            <Link
              to="/auth"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <LogIn className="h-4 w-4" />
              {t("settings.account.signIn")}
            </Link>
          </div>
        )}
      </Section>

      {/* Storage & Cache */}
      <Section icon={<HardDrive className="h-5 w-5" />} title={t("settings.storage")}>
        {storage && storage.quotaBytes > 0 ? (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("settings.storage.used")}</span>
              <span className="tabular-nums">
                {formatBytes(storage.usageBytes)} / {formatBytes(storage.quotaBytes)}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${storage.usagePercent.toFixed(1)}%` }}
              />
            </div>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={handleClearImages}
            disabled={clearing !== null}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {clearing === "images" ? t("settings.storage.clearing") : t("settings.storage.clearImages")}
          </button>
          <button
            onClick={handleClearTemp}
            disabled={clearing !== null}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {clearing === "temp" ? t("settings.storage.clearing") : t("settings.storage.clearTemp")}
          </button>
        </div>
      </Section>

      {/* Install / APK */}
      <Link
        to="/get-app"
        className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-5 transition-colors hover:bg-primary/15"
      >
        <div className="flex items-center gap-3">
          <Download className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">{t("settings.installApp")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.installApp.desc")}</p>
          </div>
        </div>
        <span className="text-sm font-medium text-primary">{t("settings.getApk")}</span>
      </Link>

      {/* Tools */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tools.map((tItem) => {
          const Icon = tItem.icon;
          return (
            <Link
              key={tItem.to}
              to={tItem.to}
              className="rounded-lg bg-card p-4 transition-all hover:-translate-y-0.5 hover:bg-secondary/50"
            >
              <Icon className="h-6 w-6 text-primary" />
              <p className="mt-2 font-semibold">{tItem.label}</p>
              <p className="text-xs text-muted-foreground">{tItem.desc}</p>
            </Link>
          );
        })}
      </div>

      {/* About */}
      <Section icon={<Info className="h-5 w-5" />} title={t("settings.about")}>
        <ul className="divide-y divide-border/50 text-sm">
          <li className="flex items-center justify-between py-2.5">
            <span className="text-muted-foreground">{t("settings.about.version")}</span>
            <span className="font-mono text-xs tabular-nums">v{APP_VERSION}</span>
          </li>
          <li>
            <Link
              to="/privacy"
              className="flex min-h-11 items-center justify-between py-2.5 hover:text-primary"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t("settings.about.privacy")}
              </span>
              <span aria-hidden>→</span>
            </Link>
          </li>
          <li>
            <Link
              to="/terms"
              className="flex min-h-11 items-center justify-between py-2.5 hover:text-primary"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("settings.about.terms")}
              </span>
              <span aria-hidden>→</span>
            </Link>
          </li>
          <li>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex min-h-11 items-center justify-between py-2.5 hover:text-primary"
            >
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t("settings.about.support")}
              </span>
              <span className="text-xs text-muted-foreground">{SUPPORT_EMAIL}</span>
            </a>
          </li>
        </ul>
      </Section>

      {/* Sources (existing) */}
      <Section icon={<Server className="h-5 w-5" />} title="Sources">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><span className="font-mono text-red-300">YouTube</span> via rotating Piped instances</li>
          <li><span className="font-mono text-orange-300">Jamendo</span> — Creative Commons full tracks</li>
          <li><span className="font-mono text-purple-300">Audius</span> — decentralized full tracks</li>
          <li><span className="font-mono text-pink-300">Deezer</span> — 30s previews (public API)</li>
        </ul>
      </Section>

      {/* Build APK (existing) */}
      <Section icon={<Smartphone className="h-5 w-5" />} title="Build APK">
        <p className="text-sm text-muted-foreground">
          This project ships with a Capacitor config. To generate an installable APK on your machine:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-background p-3 text-xs font-mono">
{`bun run build
bun run cap add android --no-sync
bun run cap sync android
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk`}
        </pre>
      </Section>

      {/* Personal use note (existing) */}
      <section className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">{t("settings.personalUse")}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("settings.personalUse.desc")}
        </p>
      </section>
    </div>
  );
}
