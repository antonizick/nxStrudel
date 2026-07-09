import { atom } from 'nanostores';

// Background video that plays behind the code editor. Videos are large and uncapped in
// size, so unlike most settings (persisted as strings in localStorage via persistentMap)
// the Blob itself lives in IndexedDB, with this atom holding only the in-memory object URL
// for whichever component wants to render it (Code.jsx for playback, VisualizerTab.jsx for
// the upload/remove controls).
export const backgroundVideoUrl = atom('');

const DB_NAME = 'strudel-background-video';
const DB_STORE = 'video';
const DB_KEY = 'current';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readVideoFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function writeVideoToDB(file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(file, DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteVideoFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(DB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// kicked off once per page load, memoized, so every mount just awaits the same in-flight
// / finished read instead of hitting IndexedDB again
let ready = null;
export function initBackgroundVideoFromDB() {
  if (ready) return ready;
  ready = (async () => {
    if (typeof indexedDB === 'undefined') return;
    try {
      const file = await readVideoFromDB();
      if (file && !backgroundVideoUrl.get()) {
        backgroundVideoUrl.set(URL.createObjectURL(file));
      }
    } catch {
      // best-effort: IndexedDB can be unavailable (e.g. private browsing) — the upload
      // still works in-memory for the session, it just won't survive a reload
    }
  })();
  return ready;
}
if (typeof window !== 'undefined') {
  initBackgroundVideoFromDB();
}

export async function setBackgroundVideo(file) {
  const prevUrl = backgroundVideoUrl.get();
  backgroundVideoUrl.set(URL.createObjectURL(file));
  if (prevUrl) URL.revokeObjectURL(prevUrl);
  await writeVideoToDB(file);
}

export async function clearBackgroundVideo() {
  const prevUrl = backgroundVideoUrl.get();
  backgroundVideoUrl.set('');
  if (prevUrl) URL.revokeObjectURL(prevUrl);
  await deleteVideoFromDB();
}
