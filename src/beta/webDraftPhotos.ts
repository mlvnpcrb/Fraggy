// Browser originals need durable bytes: object URLs alone expire on reload.
const urls = new Map<string, string>();
const prefix = (user: string) => `fraggy-draft:${user}:`;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fraggy.private-drafts.v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("photos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(Error("Could not save this photo on your device."));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode),
      request = action(tx.objectStore("photos"));
    let value: T;
    request.onsuccess = () => {
      value = request.result;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = () => {
      db.close();
      reject(Error("Could not save this photo on your device."));
    };
    tx.onabort = tx.onerror;
  });
}
export async function storeWebOriginal(uri: string, user: string, id: string) {
  const blob = await (await fetch(uri)).blob();
  const reference = prefix(user) + id;
  await transaction("readwrite", (store) => store.put(blob, reference));
  return reference;
}
export async function resolveWebOriginal(reference: string, user: string) {
  if (!reference.startsWith(prefix(user)))
    throw Error("This photo belongs to another account.");
  if (urls.has(reference)) return urls.get(reference)!;
  const blob = await transaction<Blob | undefined>("readonly", (store) =>
    store.get(reference),
  );
  if (!blob)
    throw Error("This draft photo is unavailable. Select the original again.");
  const url = URL.createObjectURL(blob);
  urls.set(reference, url);
  return url;
}
export async function removeWebOriginal(reference: string, user: string) {
  if (!reference.startsWith(prefix(user))) return;
  await transaction("readwrite", (store) => store.delete(reference));
  const url = urls.get(reference);
  if (url) URL.revokeObjectURL(url);
  urls.delete(reference);
}
export async function clearWebOriginals(user: string) {
  const keys = await transaction<IDBValidKey[]>("readonly", (store) =>
    store.getAllKeys(),
  );
  for (const key of keys)
    if (typeof key === "string" && key.startsWith(prefix(user)))
      await removeWebOriginal(key, user);
}
