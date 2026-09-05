const DB_NAME = "time-warp-media";
let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("assets");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
  });
  return database;
}
export async function readMedia(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("assets").objectStore("assets").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}
export async function writeMedia(key, blob) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    if (blob) tx.objectStore("assets").put(blob, key);
    else tx.objectStore("assets").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Image save was interrupted."));
  });
}
export async function validateImage(file) {
  if (!file?.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Choose an image smaller than 25 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
  } catch { throw new Error("This image cannot be displayed. Try a PNG or JPEG."); }
  finally { URL.revokeObjectURL(url); }
}
