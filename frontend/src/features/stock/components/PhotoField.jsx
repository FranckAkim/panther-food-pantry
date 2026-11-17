import { useEffect, useRef, useState } from "react";
import { ItemPhoto } from "../../../components/ui/ItemPhoto.jsx";
import { notifyError } from "../../../components/Notifications.jsx";
import { preparePhoto } from "../../../api/itemPhotos.js";

/**
 * Optional item photo in the add/edit item form and for new items in a donation.
 * value: null (keep current), { prepared } (new photo, already cropped and resized), or
 * { remove: true }. The preview shows exactly what students will see.
 */
export function PhotoField({ currentPath, value, onChange, disabled }) {
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    if (!value?.prepared) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(value.prepared.blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);
  const showing = value?.remove ? null : preview || currentPath;
  // Choosing disables the file button, and Remove/Undo disappear when used; return focus to the
  // file button afterwards so it stays inside the dialog.
  const inputRef = useRef(null);
  const [refocus, setRefocus] = useState(false);
  useEffect(() => {
    if (!refocus || preparing || disabled) return;
    inputRef.current?.focus();
    setRefocus(false);
  }, [refocus, preparing, disabled]);

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparing(true);
    try {
      onChange({ prepared: await preparePhoto(file) });
    } catch (error) {
      notifyError(error.message);
    } finally {
      setPreparing(false);
      setRefocus(true);
    }
  }

  return (
    <div className="stock-photo-field">
      <ItemPhoto src={preview} path={value?.remove ? null : currentPath} size="large" />
      <div className="stock-photo-copy">
        <span className="field-label">Photo (optional)</span>
        <span className="field-hint">
          Shown to students when they choose food, and in staff lists. It is cropped to 4:3.
        </span>
        <div className="stock-photo-actions">
          <label
            className={`button button--secondary stock-photo-pick ${disabled || preparing ? "is-disabled" : ""}`}
          >
            {preparing ? "Preparing photo…" : showing ? "Change photo" : "Choose photo"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="stock-sr-only"
              disabled={disabled || preparing}
              onChange={choose}
            />
          </label>
          {showing && (
            <button
              type="button"
              className="text-link"
              disabled={disabled || preparing}
              onClick={() => {
                onChange(currentPath ? { remove: true } : null);
                setRefocus(true);
              }}
            >
              Remove photo
            </button>
          )}
          {currentPath && value && (
            <button
              type="button"
              className="text-link"
              disabled={disabled || preparing}
              onClick={() => {
                onChange(null);
                setRefocus(true);
              }}
            >
              Undo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
