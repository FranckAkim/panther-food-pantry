import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { DateInput } from "./DateInput.jsx";
import { ShelfSelect } from "./ShelfSelect.jsx";

// Stock that did not come from a donation, such as a purchase. Donations use the donation form.
export function AddStock({ item, onClose, onSave }) {
  return (
    <Modal
      title="Add stock"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="stock-add-lot-form" loadingLabel="Saving…" type="submit">
            Add stock
          </Button>
        </>
      }
    >
      <AsyncForm
        id="stock-add-lot-form"
        className="stack"
        onSubmit={(e, formData) => {
          e.preventDefault();
          return onSave({
            quantity: Number(formData.get("quantity")),
            expiry: formData.get("expiry"),
            shelf: String(formData.get("shelf")).trim(),
          });
        }}
      >
        <p className="muted">
          {item.name} · received today. For donated food, use “Record donation” instead.
        </p>
        <div className="form-grid">
          <Field label={`Quantity (${item.unit})`}>
            <input className="input" name="quantity" type="number" min="1" step="1" required />
          </Field>
          <Field label="Shelf or bin">
            <ShelfSelect name="shelf" required />
          </Field>
          <Field label="Expires on" hint="Leave empty for items that don't expire.">
            <DateInput name="expiry" />
          </Field>
        </div>
      </AsyncForm>
    </Modal>
  );
}
