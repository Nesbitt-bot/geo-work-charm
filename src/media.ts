import { useEffect, useState } from "react";
import avatar from "./assets/default-avatar.jpg";
import logo from "./assets/github.svg";
import offwork from "./assets/off-work.svg";
export { default as OCTICONS_LICENSE } from "./assets/OCTICONS-LICENSE.txt?raw";
export const DEFAULT_MEDIA = { avatar, logo, offwork };
export type MediaSlot = "avatar" | "logo" | "offwork";
let database: Promise<IDBDatabase> | undefined;
function open() {
  if (!globalThis.indexedDB)
    return Promise.reject(Error("Browser image storage is unavailable."));
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("gw:badge-media", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("images");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(request.error ?? Error("Image storage failed."));
      };
    });
  return database;
}
export async function storeImage(slot: MediaSlot, file: Blob) {
  if (!file.type.startsWith("image/")) throw Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024)
    throw Error("Choose an image smaller than 8 MB.");
  if (typeof document !== "undefined" && typeof Image !== "undefined") {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth) throw Error("Invalid image");
    } catch {
      throw Error(
        "This image cannot be opened. Try PNG, JPEG, WebP, GIF or SVG.",
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put(file, slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? Error("Image could not be saved."));
    tx.onabort = () => reject(Error("Image could not be saved."));
  });
}
export async function readImage(slot: MediaSlot): Promise<Blob | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("images").objectStore("images").get(slot);
    request.onsuccess = () =>
      resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error);
  });
}
export async function removeImage(slot: MediaSlot) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").delete(slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export function useBadgeImage(
  slot: MediaSlot,
  revision: string,
  fallback: string,
) {
  const [url, setUrl] = useState(fallback);
  useEffect(() => {
    let active = true,
      objectUrl: string | undefined;
    setUrl(fallback);
    if (revision)
      void readImage(slot)
        .then((blob) => {
          if (active && blob) {
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [slot, revision, fallback]);
  return url;
}
