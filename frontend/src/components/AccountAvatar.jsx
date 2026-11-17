import { Avatar } from "./ui/Avatar.jsx";
import { useProfilePhotos } from "../hooks/useProfilePhotos.js";

/**
 * Staff and admin screens: an account's photo (if they added one) or their initials.
 * `profileId` is the account id; walk-in profiles without an account show initials.
 */
export function AccountAvatar({ profileId, name, size = "sm", alt, className }) {
  const photos = useProfilePhotos();
  return (
    <Avatar
      name={name}
      src={profileId ? photos.get(profileId) : null}
      size={size}
      alt={alt}
      className={className}
    />
  );
}

/**
 * A large photo for confirming who is at the desk (hand out food, walk-ins, student profile).
 * Shows nothing when the student has not added a photo.
 */
export function StudentPhotoCheck({ profileId, name, className = "" }) {
  const photos = useProfilePhotos();
  const src = profileId ? photos.get(profileId) : null;
  if (!src) return null;
  return (
    <figure className={`student-photo-check ${className}`.trim()}>
      <Avatar name={name} src={src} size="xl" alt={`Photo of ${name}`} />
      <figcaption>From the student's profile</figcaption>
    </figure>
  );
}
