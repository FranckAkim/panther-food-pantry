import { Modal } from "../../../components/ui/Modal.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { notifyError } from "../../../components/Notifications.jsx";
import { today } from "../utils/formatters.js";
import { Field } from "../../../components/ui/Field.jsx";
import { DateInput } from "./DateInput.jsx";

export function AddSlots({ week, onClose, onSave }) {
  return (
    <Modal
      title="Add pickup slots"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loadingLabel="Saving…" type="submit" form="stock-add-slots">
            Add slots
          </Button>
        </>
      }
    >
      <AsyncForm
        id="stock-add-slots"
        className="stack"
        onSubmit={(e, formData) => {
          e.preventDefault();
          const data = formData;
          const date = data.get("date");
          const start = data.get("start");
          const end = data.get("end");
          if (end <= start) {
            notifyError("End time must be later than start time.");
            return;
          }
          // The server skips times that already have a slot.
          return onSave({
            date,
            start,
            end,
            interval: Number(data.get("interval")),
            capacity: Number(data.get("capacity")),
          });
        }}
      >
        <Field label="Date">
          <DateInput name="date" required defaultValue={week < today() ? today() : week} />
        </Field>
        <div className="form-grid">
          <Field label="Start time">
            <input className="input" type="time" name="start" required defaultValue="10:00" />
          </Field>
          <Field label="End time">
            <input className="input" type="time" name="end" required defaultValue="14:00" />
          </Field>
          <Field label="Slot interval">
            <select className="select" name="interval">
              <option value="30">Every 30 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="60">Every hour</option>
            </select>
          </Field>
          <Field label="Capacity per slot">
            <input
              className="input"
              name="capacity"
              type="number"
              min="1"
              required
              defaultValue="5"
            />
          </Field>
        </div>
      </AsyncForm>
    </Modal>
  );
}
