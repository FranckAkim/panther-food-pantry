import { Button } from "../../../../components/ui/Button.jsx";
import { Asset } from "../Asset.jsx";
import plusPurple from "../../../../assets/stock-plus-purple.svg";
import removeIcon from "../../../../assets/stock-remove.svg";
import { Field } from "../../../../components/ui/Field.jsx";
import { DateInput } from "../DateInput.jsx";

export function DonationItems({ addItem, lines, items, setLines, updateLine }) {
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
          <p>Add each item, its quantity, expiry date, and storage location.</p>
        </div>
        <Button variant="secondary" onClick={addItem}>
          <Asset src={plusPurple} />
          Add item
        </Button>
      </header>
      {lines.length ? (
        <div className="stock-donation-items">
          {lines.map((line, index) => {
            const selectedItem = items.find((item) => item.id === line.itemId);
            return (
              <fieldset key={line.id} className="stock-donation-item">
                <legend className="stock-sr-only">Item {index + 1}</legend>
                <div className="stock-donation-item-heading">
                  <h3>Item {index + 1}</h3>
                  <button
                    className="stock-icon-button"
                    type="button"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => setLines((old) => old.filter((item) => item.id !== line.id))}
                  >
                    <Asset src={removeIcon} />
                  </button>
                </div>
                <div className="stock-donation-item-fields">
                  <Field label="Item" className="stock-donation-item-choice">
                    <select
                      className="select"
                      aria-label={`Item ${index + 1}`}
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
                    </select>
                  </Field>
                  <Field label={selectedItem ? `Quantity (${selectedItem.unit})` : "Quantity"}>
                    <input
                      className="input"
                      aria-label={`Quantity, item ${index + 1}`}
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
                      aria-label={`Expires on, item ${index + 1}`}
                      required
                      value={line.expiry}
                      onChange={(e) => updateLine(line.id, { expiry: e.target.value })}
                    />
                  </Field>
                  <Field label="Shelf or bin">
                    <input
                      className="input"
                      aria-label={`Shelf or bin, item ${index + 1}`}
                      placeholder="e.g. A2 or Cooler"
                      required
                      value={line.shelf}
                      onChange={(e) => updateLine(line.id, { shelf: e.target.value })}
                    />
                  </Field>
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
