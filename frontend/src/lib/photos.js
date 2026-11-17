// Prepares a photo chosen in the browser for upload: crops it to the target shape around the
// center and scales it down, so photos stay small and look the same in lists. Item photos use the
// default 4:3 at 800 x 600 (about 100 KB); student photos are square.

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function encode(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Returns { blob, extension } ready to upload, or throws an Error the screen can show. */
export async function preparePhoto(file, { width: WIDTH = 800, height: HEIGHT = 600 } = {}) {
  if (!file?.type?.startsWith("image/"))
    throw new Error("Choose a photo file (JPEG, PNG, or WebP).");
  if (file.size > MAX_SOURCE_BYTES)
    throw new Error("That photo is over 20 MB. Choose a smaller one.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo couldn't be opened. Try a JPEG or PNG.");
  }
  // Largest area of the target shape in the middle of the photo.
  const scale = Math.min(bitmap.width / WIDTH, bitmap.height / HEIGHT);
  const sw = WIDTH * scale;
  const sh = HEIGHT * scale;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(WIDTH, Math.round(sw));
  canvas.height = Math.round((canvas.width * HEIGHT) / WIDTH);
  canvas
    .getContext("2d")
    .drawImage(
      bitmap,
      (bitmap.width - sw) / 2,
      (bitmap.height - sh) / 2,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  bitmap.close?.();
  // Browsers that cannot encode WebP fall back to PNG; use JPEG for those instead.
  let blob = await encode(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.85);
  if (!blob) throw new Error("This photo couldn't be prepared. Try another one.");
  return { blob, extension: blob.type === "image/webp" ? "webp" : "jpg" };
}
