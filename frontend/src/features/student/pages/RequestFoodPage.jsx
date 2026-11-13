import { useRef, useState } from "react";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { dayLabel } from "../../../api/time.js";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { ItemPhoto } from "../../../components/ui/ItemPhoto.jsx";

/**
 * Step 1: a photo grid of available food, filterable by category. Once a food is chosen the
 * grid collapses to that choice so the day and time pickers follow right below it.
 */
function FoodPicker({ foods, food, foodId, chooseFood }) {
  const [browsing, setBrowsing] = useState(false);
  const [category, setCategory] = useState("");
  const chosen = useRef(null);
  const categories = [...new Set(foods.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b),
  );
  const shown = foods.filter((item) => !category || item.category === category);

  if (food && !browsing)
    return (
      <Card className="student-food-picker">
        <h2 className="student-step-title">Your food</h2>
        <div className="student-food-chosen" ref={chosen}>
          <ItemPhoto path={food.imagePath} />
          <div>
            <strong>{food.name}</strong>
            <span className="muted">{food.category}</span>
          </div>
          <Button variant="secondary" onClick={() => setBrowsing(true)}>
            Change
          </Button>
        </div>
      </Card>
    );

  return (
    <Card className="student-food-picker">
      <h2 className="student-step-title" id="student-food-title">
        Select food
      </h2>
      <p className="muted">Choose an item from the pantry's available stock.</p>
      {foods.length ? (
        <>
          {categories.length > 1 && (
            <div className="student-food-filters" role="group" aria-label="Filter by category">
              {["", ...categories].map((name) => (
                <button
                  key={name || "all"}
                  type="button"
                  aria-pressed={category === name}
                  onClick={() => setCategory(name)}
                >
                  {name || "All"}
                </button>
              ))}
            </div>
          )}
          <div className="student-food-grid" role="group" aria-labelledby="student-food-title">
            {shown.map((item) => (
              <button
                key={item.id}
                type="button"
                className="student-food-option"
                aria-pressed={foodId === item.id}
                onClick={() => {
                  chooseFood(item.id);
                  setBrowsing(false);
                  // Keep keyboard focus near the choice once the grid collapses.
                  requestAnimationFrame(() => chosen.current?.querySelector("button")?.focus());
                }}
              >
                <ItemPhoto path={item.imagePath} size="card" />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="muted">No food is available right now. Please check back later.</p>
      )}
    </Card>
  );
}

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
  slotsQuery,
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
          <FoodPicker foods={foods} food={food} foodId={foodId} chooseFood={chooseFood} />
          {food && (
            <>
              <DataLoader queries={slotsQuery} label="Loading pickup days…" compact>
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
                          aria-label={dayLabel(date)}
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
                      <div className="student-time-options">
                        {daySlots.map((slot) => {
                          const { remaining } = slot;
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
                              <span>{slot.label}</span>
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
                    {selectedSlot && ` · ${dayLabel(day)} · ${selectedSlot.label}`}
                  </p>
                  <Button
                    type="submit"
                    loadingLabel="Submitting request…"
                    disabled={!selectedSlot || selectedSlot.remaining < 1}
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
