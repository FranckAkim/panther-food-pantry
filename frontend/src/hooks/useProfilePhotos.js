import { useQuery } from "@tanstack/react-query";
import { keys } from "../api/keys.js";
import { fetchMyPhoto, fetchProfilePhotos } from "../api/profilePhotos.js";

// Photo links are signed for an hour. Reuse them for 10 minutes (so lists don't reload every
// picture on each page change) and renew them before they expire.
const PHOTO_QUERY = { staleTime: 10 * 60_000, refetchInterval: 45 * 60_000 };
const NONE = new Map();

/** Staff and admins: a Map of profile id → photo link for every account with a photo. */
export function useProfilePhotos() {
  const { data } = useQuery({
    queryKey: keys.profilePhotos,
    queryFn: fetchProfilePhotos,
    ...PHOTO_QUERY,
  });
  return data || NONE;
}

/** The signed-in account's own photo link (null without a photo) and the query state. */
export function useMyPhoto(profileId) {
  const query = useQuery({
    queryKey: keys.myPhoto(profileId),
    queryFn: () => fetchMyPhoto(profileId),
    enabled: Boolean(profileId),
    ...PHOTO_QUERY,
  });
  return { url: query.data || null, loading: query.isPending };
}
