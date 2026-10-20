import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { categories } from "../data/inventory.js";
import { DateInput } from "./DateInput.jsx";

export function ItemEditor({ item, onClose, onSave }) {
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
          onSave({
            name: f.get("name").trim(),
            category: f.get("category"),
            unit: f.get("unit").trim(),
            alert: Number(f.get("alert")),
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
        <div className="form-grid">
          <Field label="Category">
            <select
              className="select"
              name="category"
              defaultValue={item?.category || categories[0]}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Counted in">
            <input
              className="input"
              name="unit"
              placeholder="e.g. cans"
              required
              defaultValue={item?.unit || "cans"}
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
              </Field>
              <Field label="Shelf or bin">
                <input className="input" name="shelf" placeholder="A2" required />
              </Field>
            </>
          )}
        </div>
      </AsyncForm>
    </Modal>
  );
}
