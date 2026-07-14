import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "bn";
const STORAGE_KEY = "sonora.lang";

// Translation dictionary. Only settings + shared UI strings are translated on purpose —
// backend data / track titles / third-party names stay untouched (per Phase 3 rules).
const dict = {
  en: {
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.theme": "Theme",
    "settings.theme.dark": "Dark",
    "settings.theme.light": "Light",
    "settings.theme.system": "System",
    "settings.language": "Language",
    "settings.language.english": "English",
    "settings.language.bangla": "Bangla (বাংলা)",
    "settings.dataSaver": "Data Saver",
    "settings.dataSaver.desc": "Lower-quality audio, no next-track prefetch, lazy artwork. Best on mobile data.",
    "settings.account": "Account",
    "settings.account.signedInAs": "Signed in as",
    "settings.account.signedOut": "Not signed in",
    "settings.account.signIn": "Sign in",
    "settings.account.signOut": "Sign out",
    "settings.storage": "Storage & Cache",
    "settings.storage.used": "Storage used",
    "settings.storage.quota": "of quota",
    "settings.storage.clearImages": "Clear image cache",
    "settings.storage.clearTemp": "Clear temporary files",
    "settings.storage.clearing": "Clearing…",
    "settings.storage.cleared": "Cleared",
    "settings.about": "About",
    "settings.about.version": "App version",
    "settings.about.privacy": "Privacy Policy",
    "settings.about.terms": "Terms of Service",
    "settings.about.support": "Contact Support",
    "settings.installApp": "Install as Android app",
    "settings.installApp.desc": "Download the APK and install on your phone.",
    "settings.getApk": "Get APK →",
    "settings.personalUse": "Personal Use Only",
    "settings.personalUse.desc": "Not published to any app store. YouTube audio streams through Piped (respects YouTube's ToS). Deezer uses only the public preview API.",
    "offline.title": "You are offline",
    "offline.desc": "Streaming is unavailable. Downloaded tracks still play.",
    "offline.retry": "Retry",
    "offline.back": "Back online",
    "common.on": "On",
    "common.off": "Off",
  },
  bn: {
    "settings.title": "সেটিংস",
    "settings.appearance": "চেহারা",
    "settings.theme": "থিম",
    "settings.theme.dark": "ডার্ক",
    "settings.theme.light": "লাইট",
    "settings.theme.system": "সিস্টেম",
    "settings.language": "ভাষা",
    "settings.language.english": "English",
    "settings.language.bangla": "বাংলা",
    "settings.dataSaver": "ডেটা সেভার",
    "settings.dataSaver.desc": "কম-কোয়ালিটি অডিও, পরের ট্র্যাক প্রি-ফেচ বন্ধ, lazy artwork। মোবাইল ডেটাতে ভালো।",
    "settings.account": "অ্যাকাউন্ট",
    "settings.account.signedInAs": "সাইন-ইন করা আছেন",
    "settings.account.signedOut": "সাইন-ইন করা নেই",
    "settings.account.signIn": "সাইন ইন",
    "settings.account.signOut": "সাইন আউট",
    "settings.storage": "স্টোরেজ ও ক্যাশে",
    "settings.storage.used": "স্টোরেজ ব্যবহৃত",
    "settings.storage.quota": "কোটার",
    "settings.storage.clearImages": "ইমেজ ক্যাশে সাফ করুন",
    "settings.storage.clearTemp": "অস্থায়ী ফাইল সাফ করুন",
    "settings.storage.clearing": "সাফ করা হচ্ছে…",
    "settings.storage.cleared": "সাফ হয়েছে",
    "settings.about": "সম্পর্কে",
    "settings.about.version": "অ্যাপ ভার্সন",
    "settings.about.privacy": "প্রাইভেসি পলিসি",
    "settings.about.terms": "শর্তাবলী",
    "settings.about.support": "সাপোর্টে যোগাযোগ",
    "settings.installApp": "Android অ্যাপ হিসেবে ইনস্টল করুন",
    "settings.installApp.desc": "APK ডাউনলোড করে ফোনে ইনস্টল করুন।",
    "settings.getApk": "APK নিন →",
    "settings.personalUse": "শুধু ব্যক্তিগত ব্যবহার",
    "settings.personalUse.desc": "কোনো app store-এ publish করা হয়নি। YouTube অডিও Piped দিয়ে stream হয়। Deezer শুধু public preview API ব্যবহার করে।",
    "offline.title": "আপনি অফলাইনে",
    "offline.desc": "স্ট্রিমিং কাজ করবে না, শুধু ডাউনলোড করা গান বাজবে।",
    "offline.retry": "আবার চেষ্টা",
    "offline.back": "আবার অনলাইনে",
    "common.on": "চালু",
    "common.off": "বন্ধ",
  },
} as const;

export type TKey = keyof (typeof dict)["en"];

type Ctx = {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved === "en" || saved === "bn") setLangState(saved);
    } catch {}
  }, []);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", l === "bn" ? "bn" : "en");
    }
  }, []);

  const t = useCallback(
    (key: TKey) => (dict[lang] as Record<string, string>)[key] ?? (dict.en as Record<string, string>)[key] ?? key,
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so pages outside the provider don't crash.
    return { lang: "en" as Language, setLang: () => {}, t: (k: TKey) => (dict.en as Record<string, string>)[k] ?? k };
  }
  return ctx;
}
