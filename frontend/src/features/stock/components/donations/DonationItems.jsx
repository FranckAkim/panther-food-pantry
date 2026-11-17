import { Button } from "../../../../components/ui/Button.jsx";
import { Asset } from "../Asset.jsx";
import plusPurple from "../../../../assets/stock-plus-purple.svg";
import removeIcon from "../../../../assets/stock-remove.svg";
import { Field } from "../../../../components/ui/Field.jsx";
import { DateInput } from "../DateInput.jsx";
import { ShelfSelect } from "../ShelfSelect.jsx";
import { UnitSelect } from "../UnitSelect.jsx";
import { pluralUnit } from "../../../../api/mappers.js";
import { PhotoField } from "../PhotoField.jsx";
import { categoryOptions } from "../../categories.js";
import { NEW_ITEM } from "../../hooks/useDonationForm.js";
import { usePendingAction } from "../../../../components/loading/ActionContext.js";

export function DonationItems({ addItem, lines, items, setLines, updateLine, updateNewItem }) {
  const { pending } = usePendingAction();
  const categories = categoryOptions(items);
  return (
    <section
      className="stock-donation-section stock-received-section"
      aria-labelledby="donation-items-title"
    >
      <header className="stock-donation-step">
        <span className="stock-step-number" aria-hidden="true">
          2
        </span>
        <div>
          <h2 id="donation-items-title">Items received</h2>
          <p>
            Add each item, its quantity, expiry date, and storage location. For something not in the
            inventory yet, choose “+ New item”.
          </p>
        </div>
        <Button variant="secondary" onClick={addItem}>
          <Asset src={plusPurple} />
          Add item
        </Button>
      </header>
      {lines.length ? (
        <div className="stock-donation-items">
          {lines.map((line, index) => {
            const n = index + 1;
            const isNew = line.itemId === NEW_ITEM;
            const unit = isNew
              ? pluralUnit(line.newItem.unit)
              : items.find((item) => item.id === line.itemId)?.unit;
            return (
              <fieldset key={line.id} className="stock-donation-item">
                <legend className="stock-sr-only">Item {n}</legend>
                <div className="stock-donation-item-heading">
                  <h3>Item {n}</h3>
                  <button
                    className="stock-icon-button"
                    type="button"
                    aria-label={`Remove item ${n}`}
                    onClick={() => setLines((old) => old.filter((item) => item.id !== line.id))}
                  >
                    <Asset src={removeIcon} />
                  </button>
                </div>
                <div className="stock-donation-item-fields">
                  <Field label="Item" className="stock-donation-item-choice">
                    <select
                      className="select"
                      aria-label={`Item ${n}`}
                      required
                      value={line.itemId}
                      onChange={(e) => updateLine(line.id, { itemId: e.target.value })}
                    >
                      <option value="">Choose an item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                      <optgroup label="Not in the list">
                        <option value={NEW_ITEM}>+ New item (not in inventory)</option>
                      </optgroup>
                    </select>
                  </Field>
                  {isNew && (
                    <>
                      <p className="stock-donation-new-note">
                        This item is added to the inventory when you save the donation.
                      </p>
                      <Field label="New item name" className="stock-donation-span-2">
                        <input
                          className="input"
                          aria-label={`New item name, item ${n}`}
                          placeholder="e.g. Black-eyed peas"
                          required
                          maxLength={120}
                          value={line.newItem.name}
                          onChange={(e) => updateNewItem(line.id, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Category">
                        <select
                          className="select"
                          aria-label={`Category, item ${n}`}
                          required
                          value={line.newItem.category}
                          onChange={(e) => updateNewItem(line.id, { category: e.target.value })}
                        >
                          <option value="">Choose a category</option>
                          {categories.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Counted in">
                        <UnitSelect
                          aria-label={`Counted in, item ${n}`}
                          placeholder="Choose a unit"
                          required
                          value={line.newItem.unit}
                          onChange={(e) => updateNewItem(line.id, { unit: e.target.value })}
                        />
                      </Field>
                      <Field label="Low-stock alert at">
                        <input
                          className="input"
                          aria-label={`Low-stock alert at, item ${n}`}
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={line.newItem.alert}
                          onChange={(e) => updateNewItem(line.id, { alert: e.target.value })}
                        />
                      </Field>
                    </>
                  )}
                  <Field
                    label={unit ? `Quantity (${unit})` : "Quantity"}
                    className={isNew ? "stock-donation-row-start" : ""}
                  >
                    <input
                      className="input"
                      aria-label={`Quantity, item ${n}`}
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.id, {
                          quantity: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Expires on">
                    <DateInput
                      aria-label={`Expires on, item ${n}`}
                      required
                      value={line.expiry}
                      onChange={(e) => updateLine(line.id, { expiry: e.target.value })}
                    />
                  </Field>
                  <Field label="Shelf or bin">
                    <ShelfSelect
                      aria-label={`Shelf or bin, item ${n}`}
                      required
                      value={line.shelf}
                      onChange={(e) => updateLine(line.id, { shelf: e.target.value })}
                    />
                  </Field>
                  {isNew && (
                    <div className="stock-donation-item-photo">
                      <PhotoField
                        value={line.photo}
                        onChange={(photo) => updateLine(line.id, { photo })}
                        disabled={!!pending}
                      />
                    </div>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      ) : (
        <div className="stock-donation-empty">
          <h3>No items added yet</h3>
          <p>Use “Add item” to record what was received.</p>
        </div>
      )}
    </section>
  );
}
