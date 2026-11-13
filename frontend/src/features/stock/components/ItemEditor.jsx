import { useState } from "react";
import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { categoryOptions } from "../categories.js";
import { DateInput } from "./DateInput.jsx";
import { PhotoField } from "./PhotoField.jsx";
import { ShelfSelect } from "./ShelfSelect.jsx";
import { UnitSelect } from "./UnitSelect.jsx";
import { usePendingAction } from "../../../components/loading/ActionContext.js";

export function ItemEditor({ item, items = [], onClose, onSave }) {
  const [photo, setPhoto] = useState(null);
  const { pending } = usePendingAction();
  return (
    <Modal
      title={item ? "Edit item" : "Add item"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loadingLabel="Saving…" type="submit" form="stock-item-form">
            {item ? "Save changes" : "Add item"}
          </Button>
        </>
      }
    >
      <AsyncForm
        id="stock-item-form"
        className="stack"
        onSubmit={(e, formData) => {
          e.preventDefault();
          const f = formData;
          return onSave({
            name: f.get("name").trim(),
            category: f.get("category"),
            unit: f.get("unit").trim(),
            alert: Number(f.get("alert")),
            photo,
            ...(!item
              ? {
                  quantity: Number(f.get("quantity")),
                  expiry: f.get("expiry"),
                  shelf: f.get("shelf").trim(),
                }
              : {}),
          });
        }}
      >
        <Field label="Item name">
          <input className="input" name="name" required defaultValue={item?.name} />
        </Field>
        <PhotoField
          currentPath={item?.imagePath}
          value={photo}
          onChange={setPhoto}
          disabled={!!pending}
        />
        <div className="form-grid">
          <Field label="Category">
            <select
              className="select"
              name="category"
              defaultValue={item?.category || "Canned goods"}
            >
              {categoryOptions(items, item?.category).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Counted in">
            <UnitSelect
              name="unit"
              required
              current={item?.unitName}
              defaultValue={item?.unitName || "can"}
            />
          </Field>
          <Field label="Low-stock alert at">
            <input
              className="input"
              name="alert"
              type="number"
              min="0"
              required
              defaultValue={item?.alert ?? 10}
            />
          </Field>
          {!item && (
            <>
              <Field label="Opening quantity">
                <input
                  className="input"
                  name="quantity"
                  type="number"
                  min="0"
                  required
                  defaultValue="0"
                />
              </Field>
              <Field label="Expires on">
                <DateInput name="expiry" />
                <small className="muted">Leave empty for items that don't expire.</small>
              </Field>
              <Field label="Shelf or bin">
                <ShelfSelect name="shelf" />
                <small className="muted">Needed when the opening quantity is more than 0.</small>
              </Field>
            </>
          )}
        </div>
      </AsyncForm>
    </Modal>
  );
}
