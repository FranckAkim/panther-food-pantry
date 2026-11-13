import { rpc, run, supabase, toUserError } from "./client.js";
import { preparePhoto } from "../lib/photos.js";

// Profile photos (students, staff, and admins) live in the private `student-photos` bucket (named
// before staff photos were added) as `<profile id>/<file>`. Photos are personal, so they are shown
// through signed links that expire after an hour: everyone can read their own; staff and admins can
// read all. profiles.photo_path holds the path; set_my_profile_photo() switches to a new file.
const BUCKET = "student-photos";
const LINK_SECONDS = 60 * 60;
const storage = () => supabase.storage.from(BUCKET);

/** Crops a chosen photo to a 400 x 400 square (about 30 KB) for upload. */
export const prepareProfilePhoto = (file) => preparePhoto(file, { width: 400, height: 400 });

function photoError(error) {
  const message = error?.message || "";
  if (/row-level security|unauthorized|403/i.test(message))
    return new Error("You can only change your own photo.");
  if (/maximum allowed size|too large|413/i.test(message))
    return new Error("That photo is too large. Choose a smaller one.");
  if (/mime type|invalid_mime/i.test(message))
    return new Error("Choose a photo file (JPEG, PNG, or WebP).");
  return toUserError(error);
}

/** Signed links for stored photos, keyed by path. Paths that cannot be signed are left out. */
async function signedLinks(paths) {
  if (!paths.length) return new Map();
  const { data, error } = await storage().createSignedUrls(paths, LINK_SECONDS);
  if (error) throw toUserError(error);
  return new Map(
    (data || [])
      .filter((entry) => entry.path && entry.signedUrl && !entry.error)
      .map((entry) => [entry.path, entry.signedUrl]),
  );
}

/** Staff and admins: a link to every account's photo, keyed by profile id. */
export async function fetchProfilePhotos() {
  const rows = await run(
    supabase.from("profiles").select("id, photo_path").not("photo_path", "is", null),
  );
  const links = await signedLinks(rows.map((row) => row.photo_path));
  return new Map(
    rows
      .filter((row) => links.has(row.photo_path))
      .map((row) => [row.id, links.get(row.photo_path)]),
  );
}

/** The signed-in account's own photo link, or null when they have none. */
export async function fetchMyPhoto(profileId) {
  const row = await run(
    supabase.from("profiles").select("photo_path").eq("id", profileId).maybeSingle(),
  );
  const path = row?.photo_path;
  return path ? (await signedLinks([path])).get(path) || null : null;
}

// Old files are cleaned up on a best-effort basis; a leftover file does no harm.
async function removeFile(path) {
  if (!path) return;
  const { error } = await storage().remove([path]);
  if (error) console.warn("Could not delete old profile photo", path, error);
}

/** Uploads a prepared photo and makes it the account's photo, then deletes the one it replaces. */
export async function setMyPhoto(profileId, { blob, extension }) {
  const name = globalThis.crypto?.randomUUID?.() || `${Date.now()}`;
  const path = `${profileId}/${name}.${extension}`;
  const { error } = await storage().upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000", // Each upload gets a new name.
    upsert: false,
  });
  if (error) throw photoError(error);
  let previous;
  try {
    previous = await rpc("set_my_profile_photo", { p_photo_path: path });
  } catch (error) {
    await removeFile(path);
    throw error;
  }
  await removeFile(previous);
}

/** Removes the signed-in account's photo. */
export async function removeMyPhoto() {
  await removeFile(await rpc("set_my_profile_photo", { p_photo_path: null }));
}
