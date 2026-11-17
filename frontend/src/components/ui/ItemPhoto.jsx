import { useState } from "react";
import { itemPhotoUrl } from "../../api/itemPhotos.js";

/**
 * An item's photo, or a neutral placeholder when it has none or the file can't load.
 * Photos sit next to the item's name, so they are decorative (empty alt text).
 * size: "thumb" (list rows), "card" (student food picker), or "large" (item page).
 * Pass `src` instead of `path` to show a local preview.
 */
export function ItemPhoto({ path, src, size = "thumb", className = "" }) {
  const url = src || itemPhotoUrl(path);
  const [failedUrl, setFailedUrl] = useState(null);
  const classes = `item-photo item-photo--${size} ${className}`.trim();
  if (!url || failedUrl === url)
    return (
      <span className={`${classes} item-photo--empty`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3.5 8.5 12 4l8.5 4.5v7L12 20l-8.5-4.5z" strokeLinejoin="round" />
          <path d="M3.5 8.5 12 13l8.5-4.5M12 13v7" strokeLinejoin="round" />
        </svg>
      </span>
    );
  return (
    <img
      className={classes}
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(url)}
    />
  );
}
