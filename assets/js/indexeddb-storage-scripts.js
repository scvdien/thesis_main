(function () {
  const DB_NAME = "thesis_main_offline_db";
  const DB_VERSION = 1;
  const STORE_NAME = "kv";

  const hasIndexedDb = () => typeof window !== "undefined" && !!window.indexedDB;

  const requestToPromise = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const openDb = () =>
    new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const idbGet = async (db, key) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const value = await requestToPromise(store.get(key));
    return value === undefined ? null : String(value);
  };

  const idbSet = async (db, key, value) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(String(value), key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  const idbDelete = async (db, key) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  const createLocalStorageFallback = () => ({
    getItem(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    async setItem(key, value) {
      try {
        window.localStorage.setItem(key, String(value));
      } catch {
        // ignore storage write errors
      }
    },
    async removeItem(key) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore storage write errors
      }
    },
    async flush() {
      // no-op in fallback mode
    },
    async ready() {
      // no-op in fallback mode
    }
  });

  window.createIndexedStorageProxy = function createIndexedStorageProxy(keys = []) {
    if (!hasIndexedDb()) return createLocalStorageFallback();

    const normalizedKeys = Array.from(
      new Set(
        (Array.isArray(keys) ? keys : [])
          .map((key) => String(key || "").trim())
          .filter(Boolean)
      )
    );

    const keySet = new Set(normalizedKeys);
    const cache = new Map();
    const pendingOps = new Set();
    const dirtyKeys = new Set();

    normalizedKeys.forEach((key) => {
      try {
        const localValue = window.localStorage.getItem(key);
        if (localValue !== null) {
          cache.set(key, localValue);
        }
      } catch {
        // ignore localStorage read errors
      }
    });

    const dbPromise = openDb().catch(() => null);

    const trackPending = (promise) => {
      pendingOps.add(promise);
      promise.finally(() => pendingOps.delete(promise));
      return promise;
    };

    const runDbOperation = (operation) =>
      trackPending(
        dbPromise
          .then((db) => {
            if (!db) return;
            return operation(db);
          })
          .catch(() => {
            // ignore IndexedDB runtime errors
          })
      );

    const hydratePromise = trackPending(
      dbPromise
        .then(async (db) => {
          if (!db) return;
          for (const key of keySet) {
            if (dirtyKeys.has(key)) continue;
            if (cache.has(key)) {
              await idbSet(db, key, cache.get(key));
              try {
                window.localStorage.removeItem(key);
              } catch {
                // ignore localStorage cleanup errors
              }
              continue;
            }

            const dbValue = await idbGet(db, key);
            if (dbValue !== null) {
              cache.set(key, dbValue);
            }
          }
        })
        .catch(() => {
          // ignore hydration errors
        })
    );

    return {
      getItem(key) {
        const normalizedKey = String(key || "");
        return cache.has(normalizedKey) ? cache.get(normalizedKey) : null;
      },
      setItem(key, value) {
        const normalizedKey = String(key || "");
        const normalizedValue = String(value ?? "");
        dirtyKeys.add(normalizedKey);
        cache.set(normalizedKey, normalizedValue);
        try {
          window.localStorage.setItem(normalizedKey, normalizedValue);
        } catch {
          // ignore localStorage mirror write errors
        }
        return runDbOperation((db) => idbSet(db, normalizedKey, normalizedValue));
      },
      removeItem(key) {
        const normalizedKey = String(key || "");
        dirtyKeys.add(normalizedKey);
        cache.delete(normalizedKey);
        try {
          window.localStorage.removeItem(normalizedKey);
        } catch {
          // ignore localStorage cleanup errors
        }
        return runDbOperation((db) => idbDelete(db, normalizedKey));
      },
      async flush() {
        await Promise.allSettled(Array.from(pendingOps));
      },
      async ready() {
        await hydratePromise;
      }
    };
  };
})();
