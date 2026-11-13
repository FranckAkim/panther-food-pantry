import { useState } from "react";

/** "Ada Lovelace" → "AL" */
export const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/**
 * A person's photo, or their initials when there is no photo or it can't load.
 * size: "sm" (32 px, lists), "md" (44 px, header), "lg" (72 px), or "xl" (112 px, identity checks).
 * The photo sits next to the person's name, so it is decorative unless `alt` is given.
 */
export function Avatar({ name, src, size = "sm", alt = "", className = "" }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const classes = `avatar avatar--${size} ${className}`.trim();
  if (src && failedSrc !== src)
    return (
      <img
        className={classes}
        src={src}
        alt={alt}
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    );
  return (
    <span className={`${classes} avatar--initials`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
