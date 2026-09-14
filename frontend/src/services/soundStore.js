const DB_NAME = 'caregivers-local';
const STORE_NAME = 'notification-sounds';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getLocalSounds() {
  try { return JSON.parse(localStorage.getItem('caregivers-sounds') || '{}') } catch { return {} }
}

export async function getSounds() {
  const localSounds = getLocalSounds();
  try {
    const db = await openDb();
    const stored = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('all');
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = () => reject(request.error);
    });
    return Object.keys(stored || {}).length ? stored : localSounds;
  } catch {
    return localSounds;
  }
}

export async function saveSounds(sounds) {
  let dbError = null;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(sounds, 'all');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    dbError = error;
  }
  try {
    localStorage.setItem('caregivers-sounds', JSON.stringify(sounds));
  } catch (error) {
    if (dbError) throw error;
  }
}

export function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => { const duration = audio.duration; URL.revokeObjectURL(url); resolve(duration) };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid audio')) };
    audio.src = url;
  });
}
