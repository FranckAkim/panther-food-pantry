import { usePersistedState } from "../../../hooks/usePersistedState.js";
import { initialSlots } from "../data/pickupSlots.js";
import { useState, useMemo } from "react";
import { addDays, timeText } from "../utils/pickupSlots.js";
import { dateText, today } from "../utils/formatters.js";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import leftIcon from "../../../assets/stock-left.svg";
import rightIcon from "../../../assets/stock-right.svg";
import plusWhite from "../../../assets/stock-plus-white.svg";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { AddSlots } from "../components/AddSlots.jsx";

export function PickupSlots({ notify }) {
  const [slots, setSlots] = usePersistedState("panther-pickup-slots-v1", initialSlots);
  const [week, setWeek] = useState("2026-10-12");
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(week, i)), [week]);
  const end = days[4];
  const range =
    new Date(`${week}T12:00:00`).getMonth() === new Date(`${end}T12:00:00`).getMonth()
      ? `${dateText(week, false)} – ${Number(end.slice(8))}, ${end.slice(0, 4)}`
      : `${dateText(week, false)} – ${dateText(end)}`;
  return (
    <>
      <PageHeading
        title="Pickup slots"
        description="Students book these times. Tap a slot to change its capacity."
        actions={
          <>
            <Button
              variant="secondary"
              aria-label="Previous week"
              className="stock-week-button"
              onClick={() => setWeek(addDays(week, -7))}
            >
              <Asset src={leftIcon} />
            </Button>
            <span className="stock-week-label">{range}</span>
            <Button
              variant="secondary"
              aria-label="Next week"
              className="stock-week-button"
              onClick={() => setWeek(addDays(week, 7))}
            >
              <Asset src={rightIcon} />
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Asset src={plusWhite} />
              Add slots
            </Button>
          </>
        }
      />
      <DataLoader queryKey={week} initialLoading={false} label="Loading pickup slots…">
        <div className="stock-slot-board">
          {days.map((date) => {
            const daySlots = slots
              .filter((s) => s.date === date)
              .sort((a, b) => a.time.localeCompare(b.time));
            const past = date < today();
            const isToday = date === today();
            return (
              <section className={`stock-slot-day${past ? " stock-past-day" : ""}`} key={date}>
                <header className={isToday ? "stock-slot-today" : ""}>
                  <strong>
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </strong>
                  <span>{isToday ? "Today" : past ? "Past" : `${daySlots.length} slots`}</span>
                </header>
                {daySlots.map((slot) => (
                  <button
                    key={slot.id}
                    className="stock-slot"
                    type="button"
                    onClick={() => setEditing(slot)}
                    aria-label={`${dateText(date, false)}, ${timeText(slot.time)}, ${slot.booked} of ${slot.capacity} booked. Edit capacity.`}
                  >
                    <span className="stock-slot-top">
                      <strong>{timeText(slot.time)}</strong>
                      {slot.booked >= slot.capacity && <Badge tone="neutral">Full</Badge>}
                    </span>
                    <span className="muted">
                      {slot.booked} of {slot.capacity} booked
                    </span>
                    {!past && (
                      <span className="stock-progress">
                        <span
                          style={{
                            width: `${Math.min(100, (slot.booked / slot.capacity) * 100)}%`,
                          }}
                        />
                      </span>
                    )}
                  </button>
                ))}
                {!daySlots.length && <p className="stock-empty-day muted">No slots scheduled</p>}
              </section>
            );
          })}
        </div>
      </DataLoader>
      {editing && (
        <Modal
          title="Edit pickup slot"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button loadingLabel="Saving…" type="submit" form="stock-slot-form">
                Save capacity
              </Button>
            </>
          }
        >
          <AsyncForm
            id="stock-slot-form"
            className="stack"
            onSubmit={(e, formData) => {
              e.preventDefault();
              const capacity = Number(formData.get("capacity"));
              setSlots((old) => old.map((s) => (s.id === editing.id ? { ...s, capacity } : s)));
              setEditing(null);
              notify("Pickup slot capacity updated.");
            }}
          >
            <p>
              {dateText(editing.date)} · {timeText(editing.time)}
            </p>
            <Field
              label="Capacity"
              hint={`${editing.booked} students are already booked. Capacity cannot be lower than current bookings.`}
            >
              <input
                className="input"
                name="capacity"
                type="number"
                min={Math.max(1, editing.booked)}
                required
                defaultValue={editing.capacity}
              />
            </Field>
          </AsyncForm>
        </Modal>
      )}
      {adding && (
        <AddSlots
          week={week}
          slots={slots}
          onClose={() => setAdding(false)}
          onSave={(newSlots) => {
            setSlots((old) => [...old, ...newSlots]);
            setAdding(false);
            notify(`${newSlots.length} pickup ${newSlots.length === 1 ? "slot" : "slots"} added.`);
          }}
        />
      )}
    </>
  );
}
