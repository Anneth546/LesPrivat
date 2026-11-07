const DB_NAME = "aniza-private-attendance";
const DB_VERSION = 1;
let dbPromise;

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Browser ini tidak mendukung IndexedDB."));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("attendances")) {
          db.createObjectStore("attendances", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("photos")) {
          const photos = db.createObjectStore("photos", { keyPath: "id" });
          photos.createIndex("recordId", "recordId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Gagal membuka penyimpanan lokal."));
      request.onblocked = () => reject(new Error("Database sedang digunakan tab lain. Tutup tab aplikasi lain lalu coba kembali."));
    });
  }
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Operasi database gagal."));
  });
}

export async function getAttendances() {
  const db = await openDatabase();
  return requestResult(db.transaction("attendances", "readonly").objectStore("attendances").getAll());
}

export async function saveAttendanceWithPhotos(record, photos, removedPhotoIds = []) {
  const db = await openDatabase();
  const tx = db.transaction(["attendances", "photos"], "readwrite");
  tx.objectStore("attendances").put(record);
  const photoStore = tx.objectStore("photos");
  photos.forEach((photo) => photoStore.put(photo));
  removedPhotoIds.forEach((id) => photoStore.delete(id));
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Gagal menyimpan catatan dan foto."));
    tx.onabort = () => reject(tx.error || new Error("Penyimpanan catatan dibatalkan."));
  });
}

export async function removeAttendance(id) {
  const db = await openDatabase();
  const tx = db.transaction(["attendances", "photos"], "readwrite");
  tx.objectStore("attendances").delete(id);
  const photoIndex = tx.objectStore("photos").index("recordId");
  const request = photoIndex.openCursor(IDBKeyRange.only(id));
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Gagal menghapus catatan."));
    tx.onabort = () => reject(tx.error || new Error("Penghapusan catatan dibatalkan."));
  });
}

export async function addPhoto(photo) {
  const db = await openDatabase();
  return requestResult(db.transaction("photos", "readwrite").objectStore("photos").put(photo));
}

export async function getPhoto(id) {
  if (!id) return undefined;
  const db = await openDatabase();
  return requestResult(db.transaction("photos", "readonly").objectStore("photos").get(id));
}

export async function getPhotos(ids) {
  return Promise.all((ids || []).map(getPhoto));
}

export async function getAllPhotos() {
  const db = await openDatabase();
  return requestResult(db.transaction("photos", "readonly").objectStore("photos").getAll());
}

export async function removePhoto(id) {
  const db = await openDatabase();
  return requestResult(db.transaction("photos", "readwrite").objectStore("photos").delete(id));
}

export async function removePhotoFromAttendance(recordId, photoId) {
  const db = await openDatabase();
  const tx = db.transaction(["attendances", "photos"], "readwrite");
  const attendanceStore = tx.objectStore("attendances");
  const request = attendanceStore.get(recordId);
  request.onsuccess = () => {
    const record = request.result;
    if (record) {
      attendanceStore.put({
        ...record,
        photoIds: (record.photoIds || []).filter((id) => id !== photoId),
        updatedAt: new Date().toISOString()
      });
    }
    tx.objectStore("photos").delete(photoId);
  };
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Gagal menghapus foto dokumentasi."));
    tx.onabort = () => reject(tx.error || new Error("Penghapusan foto dibatalkan."));
  });
}

export async function replaceAllData(records, photos) {
  const db = await openDatabase();
  const tx = db.transaction(["attendances", "photos"], "readwrite");
  const attendanceStore = tx.objectStore("attendances");
  const photoStore = tx.objectStore("photos");
  attendanceStore.clear();
  photoStore.clear();
  records.forEach((record) => attendanceStore.put(record));
  photos.forEach((photo) => photoStore.put(photo));
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Gagal memulihkan data."));
    tx.onabort = () => reject(tx.error || new Error("Pemulihan data dibatalkan."));
  });
}

export async function clearAllData() {
  const db = await openDatabase();
  const tx = db.transaction(["attendances", "photos"], "readwrite");
  tx.objectStore("attendances").clear();
  tx.objectStore("photos").clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Gagal menghapus seluruh data."));
    tx.onabort = () => reject(tx.error || new Error("Penghapusan seluruh data dibatalkan."));
  });
}
