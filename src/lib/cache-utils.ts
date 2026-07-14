/**
 * Safe browser cache helpers. All operations are best-effort and never throw
 * to the caller — a missing Cache Storage / Service Worker / quota-restricted
 * environment must not break the Settings UI.
 */

export type StorageEstimateInfo = {
  usageBytes: number;
  quotaBytes: number;
  usagePercent: number;
};

export async function getStorageEstimate(): Promise<StorageEstimateInfo | null> {
  if (typeof navigator === "undefined") return null;
  const anyNav = navigator as Navigator & { storage?: { estimate?: () => Promise<StorageEstimate> } };
  if (!anyNav.storage?.estimate) return null;
  try {
    const est = await anyNav.storage.estimate();
    const usage = est.usage ?? 0;
    const quota = est.quota ?? 0;
    return {
      usageBytes: usage,
      quotaBytes: quota,
      usagePercent: quota > 0 ? Math.min(100, (usage / quota) * 100) : 0,
    };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Clear browser Cache Storage entries (Service Worker image/asset cache). */
export async function clearImageCache(): Promise<number> {
  if (typeof caches === "undefined") return 0;
  let cleared = 0;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      const deleted = await caches.delete(key);
      if (deleted) cleared += 1;
    }
  } catch {}
  return cleared;
}

/**
 * Clear transient localStorage entries only. Never touches:
 *  - Supabase auth keys (`sb-*`)
 *  - `sonora.lang`, `sonora.theme` (user preferences)
 *  - `sonora.recent`, `sonora.liked`, playlists, queue, etc. (user data)
 * Only removes obvious temporary caches so downloads, likes, and login survive.
 */
export function clearTemporaryFiles(): number {
  if (typeof window === "undefined") return 0;
  let cleared = 0;
  const preservePrefixes = ["sb-", "sonora.lang", "sonora.theme"];
  const preserveExact = new Set([
    "sonora.recent",
    "sonora.liked",
    "sonora.playlists",
    "sonora.queue",
    "sonora.dataSaver",
    "sonora.eq",
  ]);
  const tempPrefixes = ["sonora.cache.", "sonora.tmp.", "cache."];

  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (preserveExact.has(key)) continue;
      if (preservePrefixes.some((p) => key.startsWith(p))) continue;
      if (tempPrefixes.some((p) => key.startsWith(p))) {
        window.localStorage.removeItem(key);
        cleared += 1;
      }
    }
  } catch {}

  try {
    if (typeof sessionStorage !== "undefined") {
      cleared += sessionStorage.length;
      sessionStorage.clear();
    }
  } catch {}

  return cleared;
}
