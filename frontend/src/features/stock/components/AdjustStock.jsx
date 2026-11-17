import { useState } from "react";
import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { quantityOf } from "../utils/inventory.js";
import { Field } from "../../../components/ui/Field.jsx";
import { dateText } from "../utils/formatters.js";

// Set a lot to the counted quantity; the server records the difference with the reason.
export function AdjustStock({ item, lots, initialLot, onClose, onSave }) {
  const [lotId, setLotId] = useState(initialLot);
  const lot = lots.find((l) => l.id === lotId) || lots[0];
  const [quantity, setQuantity] = useState(lot.quantity);
  return (
    <Modal
      title="Adjust stock"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="stock-adjust-form" loadingLabel="Saving…" type="submit">
            Save adjustment
          </Button>
        </>
      }
    >
      <AsyncForm
        id="stock-adjust-form"
        className="stack"
        onSubmit={(e, formData) => {
          e.preventDefault();
          return onSave(lot.id, Number(quantity), formData.get("reason").trim());
        }}
      >
        <p className="muted">
          {item.name} · currently {quantityOf(item)} {item.unit} available
        </p>
        <Field label="Lot">
          <select
            className="select"
            value={lot.id}
            onChange={(e) => {
              setLotId(e.target.value);
              setQuantity(lots.find((l) => l.id === e.target.value).quantity);
            }}
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.expiry ? dateText(l.expiry) : "No expiry"} · {l.shelf} · {l.quantity} {item.unit}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={`New quantity (${item.unit})`}
          hint={`This lot currently has ${lot.quantity} ${item.unit}.`}
        >
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Reason for adjustment">
          <input
            className="input"
            name="reason"
            placeholder="e.g. damaged package or stock count correction"
            required
            maxLength={500}
          />
        </Field>
      </AsyncForm>
    </Modal>
  );
}
