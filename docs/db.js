// IndexedDB wrapper for offline queue

let DB = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("progress_monitor_db", 1);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("queue")) {
        const store = db.createObjectStore("queue", { keyPath: "photoId" });
        store.createIndex("uploadState", "uploadState", { unique: false });
      }
    };

    req.onsuccess = (e) => {
      DB = e.target.result;
      resolve(DB);
    };

    req.onerror = (e) => {
      reject(e);
    };
  });
}

function qPut(item) {
  return new Promise((resolve, reject) => {
    if (!DB) return reject("DB not open");
    const tx = DB.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.put(item);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e);
  });
}

function qGetAll() {
  return new Promise((resolve, reject) => {
    if (!DB) return resolve([]);
    const tx = DB.transaction("queue", "readonly");
    const store = tx.objectStore("queue");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e);
  });
}

function qDelete(photoId) {
  return new Promise((resolve, reject) => {
    if (!DB) return reject("DB not open");
    const tx = DB.transaction("queue", "readwrite");
    const store = tx.objectStore("queue");
    const req = store.delete(photoId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e);
  });
}

