import { useEffect, useRef, useState } from "react";
import { Drawer } from "./ui/Drawer.jsx";
import { Avatar } from "./ui/Avatar.jsx";
import { Button } from "./ui/Button.jsx";
import { notifyError } from "./Notifications.jsx";
import { usePendingAction } from "./loading/ActionContext.js";
import { prepareProfilePhoto, removeMyPhoto, setMyPhoto } from "../api/profilePhotos.js";
import { keys } from "../api/keys.js";
import { useRefresh } from "../lib/queryClient.js";
import { useMyPhoto } from "../hooks/useProfilePhotos.js";

/**
 * "Your profile" for any signed-in account: name and email, `details` rows ([label, value]), an
 * optional photo (`photoHint` says who sees it), and Sign out when `signOut` is given.
 */
export function ProfileDrawer({ profile, details = [], photoHint, onClose, signOut, notify }) {
  const refresh = useRefresh();
  const { pending } = usePendingAction();
  const { url } = useMyPhoto(profile.id);
  // A photo chosen but not saved yet: { prepared, preview } (preview is a local object URL).
  const [chosen, setChosen] = useState(null);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => () => chosen && URL.revokeObjectURL(chosen.preview), [chosen]);
  const busy = Boolean(pending) || preparing;

  // Each step replaces or disables the focused control, which would drop focus out of the
  // drawer (and Escape would stop working). Once the step settles, focus the next control:
  // "pick" is the photo file button; "button" is the first action button (Save or Remove).
  const pickRef = useRef(null);
  const actionsRef = useRef(null);
  const [focusNext, setFocusNext] = useState(null);
  useEffect(() => {
    if (!focusNext || busy) return;
    const target =
      focusNext === "pick" ? pickRef.current : actionsRef.current?.querySelector("button");
    if (target && !target.disabled) {
      target.focus();
      setFocusNext(null);
    }
  }, [focusNext, busy, chosen, url]);

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparing(true);
    try {
      const prepared = await prepareProfilePhoto(file);
      setChosen({ prepared, preview: URL.createObjectURL(prepared.blob) });
      setFocusNext("button");
    } catch (error) {
      notifyError(error.message);
      setFocusNext("pick");
    } finally {
      setPreparing(false);
    }
  }
  async function save() {
    try {
      await setMyPhoto(profile.id, chosen.prepared);
      await refresh([keys.myPhoto(profile.id)]);
    } catch (error) {
      setFocusNext("button");
      throw error;
    }
    setChosen(null);
    setFocusNext("pick");
    notify("Your photo was saved.");
  }
  async function remove() {
    try {
      await removeMyPhoto();
      await refresh([keys.myPhoto(profile.id)]);
    } catch (error) {
      setFocusNext("button");
      throw error;
    }
    setFocusNext("pick");
    notify("Your photo was removed.");
  }

  return (
    <Drawer
      title="Your profile"
      onClose={onClose}
      footer={
        signOut && (
          <Button variant="secondary" asyncAction loadingLabel="Signing out…" onClick={signOut}>
            Sign out
          </Button>
        )
      }
    >
      <div className="profile-drawer">
        <div className="profile-drawer-person">
          <Avatar
            name={profile.name}
            src={chosen?.preview || url}
            size="xl"
            alt={chosen ? "Preview of your new photo" : url ? "Your photo" : ""}
          />
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.email}</span>
          </div>
        </div>
        {details.length > 0 && (
          <dl className="profile-drawer-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <section className="profile-drawer-photo" aria-labelledby="profile-photo-title">
          <h3 id="profile-photo-title">Profile photo (optional)</h3>
          <p>{photoHint}</p>
          {chosen ? (
            <>
              <p className="profile-drawer-preview-note">
                This is how your photo will look. Save it to use it.
              </p>
              <div className="profile-drawer-actions" ref={actionsRef}>
                <Button asyncAction loadingLabel="Saving photo…" onClick={save}>
                  Save photo
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setChosen(null);
                    setFocusNext("pick");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="profile-drawer-actions" ref={actionsRef}>
              <label
                className={`button button--secondary profile-photo-pick ${busy ? "is-disabled" : ""}`}
              >
                {preparing ? "Preparing photo…" : url ? "Change photo" : "Add a photo"}
                <input
                  ref={pickRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="profile-photo-input"
                  disabled={busy}
                  onChange={choose}
                />
              </label>
              {url && (
                <Button variant="ghost" asyncAction loadingLabel="Removing photo…" onClick={remove}>
                  Remove photo
                </Button>
              )}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}
