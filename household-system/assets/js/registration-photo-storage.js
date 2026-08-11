(function () {
  "use strict";

  const DB_NAME = "thesis_main_offline_db";
  const DB_VERSION = 2;
  const KV_STORE_NAME = "kv";
  const PHOTO_STORE_NAME = "registration_photos";
  const PHOTO_ENDPOINT = "registration-photo.php";
  const PHOTO_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const PHOTO_SUBJECT_TYPES = new Set(["household", "head", "member"]);
  const PHOTO_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const MAX_LOCAL_PHOTO_BYTES = 1024 * 1024;

  let dbPromise = null;

  const requestToPromise = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });

  const transactionToPromise = (transaction) =>
    new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction was aborted."));
    });

  const openDb = () =>
    new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      let blocked = false;

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(KV_STORE_NAME)) {
          db.createObjectStore(KV_STORE_NAME);
        }
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          db.createObjectStore(PHOTO_STORE_NAME, { keyPath: "photo_id" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        if (blocked) {
          db.close();
          return;
        }
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          db.close();
          reject(new Error(`IndexedDB store ${PHOTO_STORE_NAME} is unavailable.`));
          return;
        }
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error("Unable to open offline photo storage."));
      };
      request.onblocked = () => {
        blocked = true;
        reject(new Error("Close other open registration tabs, then reload to enable photo storage."));
      };
    });

  const getDb = () => {
    if (!dbPromise) {
      dbPromise = openDb().catch((error) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  };

  const normalizePhotoId = (photoId) => {
    const normalized = String(photoId || "").trim().toLowerCase();
    if (!PHOTO_ID_PATTERN.test(normalized)) {
      throw new TypeError("A valid photoId is required.");
    }
    return normalized;
  };

  const normalizeSubjectType = (subjectType) => {
    const normalized = String(subjectType || "").trim().toLowerCase();
    if (!PHOTO_SUBJECT_TYPES.has(normalized)) {
      throw new TypeError("A valid photo subject type is required.");
    }
    return normalized;
  };

  const normalizeOwnerId = (ownerUserId) => {
    if (ownerUserId === undefined || ownerUserId === null) return "";
    return String(ownerUserId).trim();
  };

  const requireOwnerId = (ownerUserId) => {
    const normalizedOwnerId = normalizeOwnerId(ownerUserId);
    if (!normalizedOwnerId) {
      throw new TypeError("An expectedOwnerUserId is required for local photo access.");
    }
    return normalizedOwnerId;
  };

  const assertRecordOwner = (record, expectedOwnerUserId) => {
    if (!record) return;
    const expectedOwnerId = requireOwnerId(expectedOwnerUserId);
    const recordOwnerId = normalizeOwnerId(record.owner_user_id);
    if (!recordOwnerId || recordOwnerId !== expectedOwnerId) {
      const error = new Error("This local photo belongs to another signed-in user.");
      error.code = "photo_owner_mismatch";
      error.status = 403;
      throw error;
    }
  };

  const normalizeDimension = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
  };

  const isBlob = (value) => typeof Blob !== "undefined" && value instanceof Blob;

  const fileExtensionForMime = (mimeType) => {
    const extensions = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };
    return extensions[String(mimeType || "").trim().toLowerCase()] || "bin";
  };

  const randomBytes = () => {
    const bytes = new Uint8Array(16);
    const cryptoApi = typeof window !== "undefined" ? window.crypto : null;
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      cryptoApi.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    return bytes;
  };

  const createPhotoId = () => {
    const cryptoApi = typeof window !== "undefined" ? window.crypto : null;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }

    const bytes = randomBytes();
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  };

  const ready = async () => {
    await getDb();
  };

  const getRaw = async (photoId) => {
    const normalizedPhotoId = normalizePhotoId(photoId);
    const db = await getDb();
    const transaction = db.transaction(PHOTO_STORE_NAME, "readonly");
    const value = await requestToPromise(transaction.objectStore(PHOTO_STORE_NAME).get(normalizedPhotoId));
    return value === undefined ? null : value;
  };

  const get = async (photoId, { expectedOwnerUserId = "" } = {}) => {
    const record = await getRaw(photoId);
    assertRecordOwner(record, expectedOwnerUserId);
    return record;
  };

  const put = async ({
    photoId,
    blob,
    subjectType = "member",
    ownerUserId = "",
    width = null,
    height = null,
    mimeType = ""
  } = {}) => {
    const normalizedPhotoId = normalizePhotoId(photoId);
    if (!isBlob(blob)) {
      throw new TypeError("blob must be a Blob or File.");
    }
    if (blob.size <= 0 || blob.size > MAX_LOCAL_PHOTO_BYTES) {
      throw new TypeError("Photo must be smaller than 1 MB.");
    }

    const normalizedOwnerId = requireOwnerId(ownerUserId);
    const existing = await getRaw(normalizedPhotoId);
    assertRecordOwner(existing, normalizedOwnerId);
    const timestamp = new Date().toISOString();
    const normalizedMimeType = String(mimeType || blob.type || "application/octet-stream").trim().toLowerCase()
      || "application/octet-stream";
    if (!PHOTO_MIME_TYPES.has(normalizedMimeType)) {
      throw new TypeError("Only JPEG, PNG, and WebP photos are supported.");
    }
    const record = {
      photo_id: normalizedPhotoId,
      blob,
      subject_type: normalizeSubjectType(subjectType || "member"),
      owner_user_id: normalizedOwnerId,
      width: normalizeDimension(width),
      height: normalizeDimension(height),
      mime_type: normalizedMimeType,
      created_at: existing && existing.created_at ? existing.created_at : timestamp,
      updated_at: timestamp
    };

    const db = await getDb();
    const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(PHOTO_STORE_NAME).put(record);
    await completion;
    return record;
  };

  const remove = async (photoId, { expectedOwnerUserId = "" } = {}) => {
    const normalizedPhotoId = normalizePhotoId(photoId);
    const existing = await getRaw(normalizedPhotoId);
    if (!existing) return false;
    assertRecordOwner(existing, expectedOwnerUserId);
    const db = await getDb();
    const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    transaction.objectStore(PHOTO_STORE_NAME).delete(normalizedPhotoId);
    await completion;
    return true;
  };

  const removeMany = async (photoIds, { expectedOwnerUserId = "" } = {}) => {
    const normalizedOwnerId = requireOwnerId(expectedOwnerUserId);
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(photoIds) ? photoIds : [])
          .map((photoId) => {
            try {
              return normalizePhotoId(photoId);
            } catch {
              return "";
            }
          })
          .filter(Boolean)
      )
    );
    if (normalizedIds.length === 0) return 0;

    let removedCount = 0;
    for (const photoId of normalizedIds) {
      if (await remove(photoId, { expectedOwnerUserId: normalizedOwnerId })) {
        removedCount += 1;
      }
    }
    return removedCount;
  };

  const removeByOwner = async (ownerId) => {
    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (!normalizedOwnerId) {
      throw new TypeError("An ownerId is required.");
    }

    const db = await getDb();
    const transaction = db.transaction(PHOTO_STORE_NAME, "readwrite");
    const completion = transactionToPromise(transaction);
    const cursorRequest = transaction.objectStore(PHOTO_STORE_NAME).openCursor();
    let removedCount = 0;

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const recordOwnerId = normalizeOwnerId(cursor.value && cursor.value.owner_user_id);
      if (recordOwnerId === normalizedOwnerId) {
        cursor.delete();
        removedCount += 1;
      }
      cursor.continue();
    };

    await completion;
    return removedCount;
  };

  const getPreviewSource = async (photoId, { expectedOwnerUserId = "" } = {}) => {
    const normalizedPhotoId = normalizePhotoId(photoId);
    const record = await get(normalizedPhotoId, { expectedOwnerUserId });
    const urlApi = typeof window !== "undefined" ? window.URL : null;
    if (record && isBlob(record.blob) && urlApi && typeof urlApi.createObjectURL === "function") {
      return {
        src: urlApi.createObjectURL(record.blob),
        isObjectUrl: true
      };
    }
    return {
      src: `${PHOTO_ENDPOINT}?id=${encodeURIComponent(normalizedPhotoId)}`,
      isObjectUrl: false
    };
  };

  const upload = async (photoId, {
    csrfToken = "",
    subjectType = "",
    expectedOwnerUserId = ""
  } = {}) => {
    const normalizedPhotoId = normalizePhotoId(photoId);
    const record = await get(normalizedPhotoId, { expectedOwnerUserId });
    if (!record || !isBlob(record.blob)) {
      return { success: true, skipped: true };
    }

    const normalizedSubjectType = normalizeSubjectType(subjectType || record.subject_type || "member");
    const formData = new FormData();
    formData.append("photo_id", normalizedPhotoId);
    formData.append("subject_type", normalizedSubjectType);
    formData.append("photo", record.blob, `${normalizedPhotoId}.${fileExtensionForMime(record.mime_type || record.blob.type)}`);

    const normalizedCsrfToken = String(csrfToken || "").trim();
    const headers = { Accept: "application/json" };
    if (normalizedCsrfToken) {
      headers["X-CSRF-Token"] = normalizedCsrfToken;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
    let response;
    try {
      response = await fetch(PHOTO_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: formData,
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Photo upload timed out. It will retry when the connection improves.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error("Photo upload returned an invalid response.");
    }

    if (!response.ok || !payload || payload.success !== true) {
      const responseMessage = payload && (payload.error || payload.message);
      const message = typeof responseMessage === "string" && responseMessage.trim()
        ? responseMessage.trim()
        : `Photo upload failed (${response.status}).`;
      const uploadError = new Error(message);
      uploadError.status = response.status;
      uploadError.payload = payload;
      throw uploadError;
    }

    return payload;
  };

  window.registrationPhotoStorage = Object.freeze({
    ready,
    createPhotoId,
    put,
    get,
    remove,
    removeMany,
    removeByOwner,
    getPreviewSource,
    upload
  });
})();
