const DB_NAME = 'caregivers-local';
const STORE_NAME = 'notification-sounds';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getSounds() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('all');
      request.onsuccess = () => resolve(request.result || {});
      request.onerror = () => reject(request.error);
    });
  } catch {
    try { return JSON.parse(localStorage.getItem('caregivers-sounds') || '{}') } catch { return {} }
  }
}

export async function saveSounds(sounds) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(sounds, 'all');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  try { localStorage.setItem('caregivers-sounds', JSON.stringify(sounds)) } catch {}
}
