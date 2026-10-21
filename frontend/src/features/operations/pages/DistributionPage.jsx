import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Status } from "../components/Status.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Asset } from "../components/Asset.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

export function DistributionPage({
  textLink,
  selectedPickup,
  pending,
  idChecked,
  setIdChecked,
  addItem,
  itemId,
  setItemId,
  availableCatalog,
  quantity,
  setQuantity,
  displayedItems,
  setItems,
  items,
  navigate,
  completePickup,
}) {
  return (
    <>
      <div className="sr-distribution-heading">
        <div className="sr-breadcrumb">
          {textLink("Today's pickups", "/staff/pickups")}
          <span>/ {selectedPickup.name}</span>
        </div>
        <PageHeading
          title="Hand out food"
          description={`${selectedPickup.name} · ${selectedPickup.studentId} · ${selectedPickup.slot || selectedPickup.time || "Walk-in"}`}
        />
      </div>
      <Card className="sr-student-summary">
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{selectedPickup.name}</dd>
          </div>
          <div>
            <dt>Student ID</dt>
            <dd>{selectedPickup.studentId}</dd>
          </div>
          <div>
            <dt>Request</dt>
            <dd>
              <Status status={selectedPickup.status || "Approved"} />
            </dd>
          </div>
          <div>
            <dt>Note</dt>
            <dd>{selectedPickup.note || "—"}</dd>
          </div>
        </dl>
        {selectedPickup.firstVisit && (
          <label className="sr-id-check">
            <span>First visit</span>
            <input
              type="checkbox"
              disabled={!!pending}
              checked={idChecked}
              onChange={(e) => setIdChecked(e.target.checked)}
            />
            I checked the student ID card
          </label>
        )}
      </Card>
      <Card className="sr-distribution-card">
        <div className="sr-distribution-top">
          <h2>Items</h2>
          <p className="muted">
            Oldest food goes out first. The system picks the lots that expire soonest.
          </p>
          <form className="sr-add-item" onSubmit={addItem}>
            <Field label="Add an item">
              <select
                className="select"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                disabled={!!pending}
              >
                <option value="">Choose an item</option>
                {availableCatalog
                  .filter((item) => item.onHand > 0)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.onHand} {item.plural} available
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Qty">
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                aria-label="Quantity"
                disabled={!!pending}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            <Button variant="secondary" type="submit">
              Add
            </Button>
          </form>
        </div>

        <div className="table-wrap">
          <table className="data-table sr-distribution-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Taken from</th>
                <th className="sr-number">On hand</th>
                <th>
                  <span className="sr-visually-hidden">Remove item</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    {item.qty} {item.qty === 1 ? item.unit : item.plural}
                  </td>
                  <td>
                    <div className="sr-lot">
                      <span className="muted">
                        Expires {item.expires} · {item.shelf}
                      </span>
                      {item.expiring && <Badge tone="orange">Expires soon</Badge>}
                    </div>
                  </td>
                  <td className="sr-number">{item.onHand}</td>
                  <td>
                    <button
                      disabled={!!pending}
                      className="sr-remove-item"
                      onClick={() => {
                        setItems((current) => current.filter((i) => i.id !== item.id));
                      }}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Asset name="remove" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <EmptyState
            title="No items added"
            description="Choose an item from the dropdown and add the quantity being handed out."
          />
        )}
        <div className="sr-distribution-footer">
          <span>
            {items.length} items · {items.reduce((sum, item) => sum + item.qty, 0)} units
          </span>
          <div>
            <Button variant="secondary" onClick={() => navigate("/staff/pickups")}>
              Cancel
            </Button>
            <Button asyncAction loadingLabel="Completing pickup…" onClick={completePickup}>
              Complete pickup
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
