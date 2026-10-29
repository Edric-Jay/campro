import type { CaptureRecord } from "./records";
import type { AppSettings, Preset, StoredLut } from "./settings";
import { sanitizeSettings } from "./settings";

const DB_NAME = "camlut-pro";
const DB_VERSION = 1;

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
      if (!db.objectStoreNames.contains("presets")) db.createObjectStore("presets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("luts")) db.createObjectStore("luts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("captures")) db.createObjectStore("captures", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The local storage request failed."));
  });
}

async function readStore<T>(name: "settings" | "presets" | "luts" | "captures", request: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await requestToPromise(request(db.transaction(name, "readonly").objectStore(name)));
  } finally {
    db.close();
  }
}

async function writeStore(name: "settings" | "presets" | "luts" | "captures", write: (store: IDBObjectStore) => void) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(name, "readwrite");
    write(transaction.objectStore(name));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not write local storage."));
  });
  db.close();
}

export async function loadSettings() {
  const stored = await readStore("settings", (store) => store.get("app"));
  return sanitizeSettings(stored);
}

export async function saveSettings(settings: AppSettings) {
  const next = sanitizeSettings(settings);
  await writeStore("settings", (store) => {
    store.put(next, "app");
  });
  return next;
}

export async function listPresets() {
  const presets = await readStore("presets", (store) => store.getAll() as IDBRequest<Preset[]>);
  return presets.sort((a, b) => a.createdAt - b.createdAt);
}

export async function savePreset(preset: Preset) {
  await writeStore("presets", (store) => {
    store.put(preset);
  });
}

export async function removePreset(id: string) {
  await writeStore("presets", (store) => {
    store.delete(id);
  });
}

export async function replacePresets(presets: Preset[]) {
  await writeStore("presets", (store) => {
    store.clear();
    for (const preset of presets) store.put(preset);
  });
}

export async function listLuts() {
  return readStore("luts", (store) => store.getAll() as IDBRequest<StoredLut[]>);
}

export async function saveLut(lut: StoredLut) {
  await writeStore("luts", (store) => {
    store.put(lut);
  });
}

export async function removeLut(id: string) {
  await writeStore("luts", (store) => {
    store.delete(id);
  });
}

export async function listCaptures() {
  const captures = await readStore("captures", (store) => store.getAll() as IDBRequest<CaptureRecord[]>);
  return captures.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCapture(id: string) {
  const capture = await readStore("captures", (store) => store.get(id) as IDBRequest<CaptureRecord | undefined>);
  return capture ?? null;
}

export async function saveCapture(capture: CaptureRecord) {
  if (!capture.graded || capture.graded.size === 0 || !capture.thumbnail || capture.thumbnail.size === 0) {
    throw new Error("The capture was incomplete and was not saved.");
  }
  await writeStore("captures", (store) => {
    store.put(capture);
  });
}

export async function updateCapture(capture: CaptureRecord) {
  await saveCapture(capture);
}

export async function deleteCapture(id: string) {
  await writeStore("captures", (store) => {
    store.delete(id);
  });
}
