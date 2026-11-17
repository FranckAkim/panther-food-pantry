import { rpc, supabase, toUserError } from "./client.js";
import { preparePhoto } from "../lib/photos.js";

// Item photos live in the public `item-images` Storage bucket as `<item id>/<file>`.
// The database stores the path; staff_set_item_image() switches an item to a new file.
const BUCKET = "item-images";
const storage = () => supabase.storage.from(BUCKET);

/** Public link for a stored item photo, or null when the item has none. */
export const itemPhotoUrl = (path) => (path ? storage().getPublicUrl(path).data.publicUrl : null);

function photoError(error) {
  const message = error?.message || "";
  if (/row-level security|unauthorized|403/i.test(message))
    return new Error("Only pantry staff can change item photos.");
  if (/maximum allowed size|too large|413/i.test(message))
    return new Error("That photo is too large. Choose a smaller one.");
  if (/mime type|invalid_mime/i.test(message))
    return new Error("Choose a photo file (JPEG, PNG, or WebP).");
  return toUserError(error);
}

// Old files are cleaned up on a best-effort basis; a leftover file does no harm.
async function removeFile(path) {
  if (!path) return;
  const { error } = await storage().remove([path]);
  if (error) console.warn("Could not delete old item photo", path, error);
}

export { preparePhoto };

/**
 * Staff: uploads a photo and makes it the item's photo, then deletes the one it replaces.
 * `photo` is the result of preparePhoto(file).
 */
export async function setItemPhoto(itemId, { blob, extension }) {
  const name = globalThis.crypto?.randomUUID?.() || `${Date.now()}`;
  const path = `${itemId}/${name}.${extension}`;
  const { error } = await storage().upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000", // Each upload gets a new name, so browsers may cache it for a year.
    upsert: false,
  });
  if (error) throw photoError(error);
  let previous;
  try {
    previous = await rpc("staff_set_item_image", { p_item_id: itemId, p_image_path: path });
  } catch (error) {
    await removeFile(path);
    throw error;
  }
  await removeFile(previous);
}

/** Staff: removes the item's photo. */
export async function removeItemPhoto(itemId) {
  const previous = await rpc("staff_set_item_image", { p_item_id: itemId, p_image_path: null });
  await removeFile(previous);
}

/** Applies the photo choice from the item form: a new photo, a removal, or nothing. */
export async function savePhotoChange(itemId, photo) {
  if (photo?.prepared) await setItemPhoto(itemId, photo.prepared);
  else if (photo?.remove) await removeItemPhoto(itemId);
}
