import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { dateLabel, slotLabel } from "../utils.js";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function RequestFoodPage({
  open,
  requestCard,
  submit,
  foodId,
  chooseFood,
  foods,
  food,
  days,
  day,
  setDay,
  setSlotId,
  daySlots,
  slotId,
  note,
  setNote,
  selectedSlot,
}) {
  return (
    <>
      <PageHeading
        title="Request food"
        description="Choose your food, then pick a day and time. You can have one open request at a time."
      />
      {open ? (
        <>
          <p className="notice">
            You already have an open request. To request a different food or time, cancel it below
            first.
          </p>
          {requestCard}
        </>
      ) : (
        <AsyncForm className="student-request-form" onSubmit={submit}>
          <Card className="student-food-picker">
            <Field label="Select food" hint="Choose an item from the pantry's available stock.">
              <select required value={foodId} onChange={(event) => chooseFood(event.target.value)}>
                <option value="">Choose a food item</option>
                {foods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            {!foods.length && (
              <p className="muted">No food is available right now. Please check back later.</p>
            )}
          </Card>
          {food && (
            <>
              <DataLoader queryKey={foodId} label="Loading pickup days…" compact>
                <Card className="student-slot-picker">
                  <fieldset>
                    <legend>Pick a day</legend>
                    <div className="student-days">
                      {days.map((date) => (
                        <button
                          key={date}
                          type="button"
                          className={day === date ? "selected" : ""}
                          aria-pressed={day === date}
                          aria-label={dateLabel(date)}
                          onClick={() => {
                            setDay(date);
                            setSlotId("");
                          }}
                        >
                          <span>
                            {new Date(`${date}T12:00:00`)
                              .toLocaleDateString("en-US", { weekday: "short" })
                              .toUpperCase()}
                          </span>
                          <strong>{Number(date.slice(8))}</strong>
                          <span>
                            {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
                              month: "short",
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                    {!days.length && <p className="muted">No pickup days are scheduled yet.</p>}
                  </fieldset>
                  <fieldset>
                    <legend>Pick a time</legend>
                    {day ? (
                      <DataLoader queryKey={day} label="Loading pickup times…" compact>
                        <div className="student-time-options">
                          {daySlots.map((slot) => {
                            const remaining = Math.max(0, slot.capacity - slot.booked);
                            return (
                              <label
                                key={slot.id}
                                className={`student-time-option ${slotId === slot.id ? "selected" : ""} ${!remaining ? "full" : ""}`}
                              >
                                <input
                                  type="radio"
                                  name="pickupTime"
                                  value={slot.id}
                                  checked={slotId === slot.id}
                                  disabled={!remaining}
                                  onChange={() => setSlotId(slot.id)}
                                />
                                <span>{slotLabel(slot)}</span>
                                {!remaining ? (
                                  <Badge>Full</Badge>
                                ) : (
                                  <small>
                                    {remaining} {remaining === 1 ? "spot" : "spots"} left
                                  </small>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </DataLoader>
                    ) : (
                      <p className="muted">Select a day to see available pickup times.</p>
                    )}
                  </fieldset>
                </Card>
              </DataLoader>
              <Card className="student-submit-card">
                <Field
                  label="Dietary note (optional)"
                  hint="Let staff know about any food allergies or dietary preferences."
                >
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Vegetarian, no pork, or food allergies"
                    maxLength={500}
                    rows={2}
                  />
                </Field>
                <div className="student-submit-actions">
                  <p className="muted">
                    {food.name}
                    {selectedSlot && ` · ${dateLabel(day)} · ${slotLabel(selectedSlot)}`}
                  </p>
                  <Button
                    type="submit"
                    loadingLabel="Submitting request…"
                    disabled={!selectedSlot || selectedSlot.booked >= selectedSlot.capacity}
                  >
                    Submit request
                  </Button>
                </div>
              </Card>
            </>
          )}
        </AsyncForm>
      )}
    </>
  );
}
