import { useEffect, useState } from "react";
import type { UnifiedTrack } from "./player-context";

const DB_NAME = "sonora-downloads";
const STORE = "tracks";
const VERSION = 1;

export type DownloadedTrack = {
  track: UnifiedTrack;
  blob: Blob;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function notify() {
  window.dispatchEvent(new CustomEvent("sonora:downloads"));
}

async function fetchBlobWithRetry(url: string, attempts = 3): Promise<Blob> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const details = await res.text().catch(() => "");
        throw new Error(details || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Downloaded file is empty");
      return blob;
    } catch (error) {
      lastError = error;
      if (i === attempts - 1) break;
      await new Promise((resolve) => window.setTimeout(resolve, 500 + i * 750));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Download failed");
}

export async function saveDownload(track: UnifiedTrack, streamUrl: string) {
  const blob = await fetchBlobWithRetry(streamUrl);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: track.id, track, blob, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notify();
}

export async function deleteDownload(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notify();
}

export async function listDownloads(): Promise<DownloadedTrack[]> {
  const db = await openDb();
  const items = await new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return items as DownloadedTrack[];
}

export async function getDownloadBlobUrl(id: string): Promise<string | null> {
  const db = await openDb();
  const item = await new Promise<any>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!item) return null;
  return URL.createObjectURL(item.blob);
}

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = async () => {
    if (typeof window === "undefined") return;
    try {
      const items = await listDownloads();
      setDownloads(items);
      setIds(new Set(items.map((d) => d.track.id)));
    } catch {}
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("sonora:downloads", handler);
    return () => window.removeEventListener("sonora:downloads", handler);
  }, []);

  return { downloads, isDownloaded: (id: string) => ids.has(id), refresh };
}
