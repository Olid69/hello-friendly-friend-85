import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Upgrade artwork URLs to higher resolution when the source supports it.
 * Safe no-op for unknown hosts.
 */
export function hiResArtwork(url: string | undefined | null): string {
  if (!url) return "";
  try {
    let u = url;
    // YouTube thumbs (direct or via Piped proxy): swap to maxresdefault
    if (/\/vi\/[^/]+\/(default|mqdefault|hqdefault|sddefault|hq720)\.jpg/.test(u)) {
      u = u.replace(
        /\/vi\/([^/]+)\/(default|mqdefault|hqdefault|sddefault|hq720)\.jpg/,
        "/vi/$1/maxresdefault.jpg",
      );
    }
    // Deezer cover: bump to 1000x1000
    if (/e-cdns-images\.dzcdn\.net\/images\//.test(u)) {
      u = u.replace(/\/(56|120|250|500)x\1/g, "/1000x1000");
    }
    // Audius / generic /150x150 or /480x480 upgrade
    if (/\/(150x150|480x480)\.(jpg|png|jpeg|webp)/.test(u)) {
      u = u.replace(/\/(150x150|480x480)\./, "/1000x1000.");
    }
    // Jamendo album covers: size param → 600
    u = u.replace(/([?&])size=(?:100|150|200|300|400|500)(&|$)/, "$1size=600$2");
    return u;
  } catch {
    return url;
  }
}
