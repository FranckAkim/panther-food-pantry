import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Status } from "../components/Status.jsx";
import { Field } from "../../../components/ui/Field.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { Asset } from "../components/Asset.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { ItemPhoto } from "../../../components/ui/ItemPhoto.jsx";
import { StudentPhotoCheck } from "../../../components/AccountAvatar.jsx";

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
  setItemQty,
  items,
  units,
  requestedFood,
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
        <StudentPhotoCheck profileId={selectedPickup.recipientId} name={selectedPickup.name} />
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
              {selectedPickup.requestId ? (
                <Status status={selectedPickup.status || "Approved"} />
              ) : (
                "Walk-in"
              )}
            </dd>
          </div>
          {requestedFood && (
            <div>
              <dt>Requested food</dt>
              <dd>{requestedFood.name}</dd>
            </div>
          )}
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
            {requestedFood
              ? "The food the student requested is listed first. Change its quantity, remove it, or add other items. "
              : ""}
            Oldest food goes out first. The system picks the lots that expire soonest.
          </p>
          {requestedFood && !requestedFood.available && (
            <p className="sr-requested-unavailable" role="status">
              {requestedFood.name} (requested) is out of stock right now. Choose something else for
              this pickup.
            </p>
          )}
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
                  <td>
                    <span className="sr-item-cell">
                      <ItemPhoto path={item.imagePath} />
                      {item.name}
                      {item.requested && <Badge tone="purple">Requested</Badge>}
                    </span>
                  </td>
                  <td>
                    <span className="sr-qty-cell">
                      <input
                        className="input sr-qty-input"
                        type="number"
                        min="1"
                        max={item.onHand}
                        step="1"
                        aria-label={`Quantity of ${item.name}`}
                        disabled={!!pending}
                        value={item.qty}
                        onChange={(e) => setItemQty(item.id, e.target.value)}
                      />
                      {item.qty === 1 ? item.unit : item.plural}
                    </span>
                  </td>
                  <td>
                    <div className="sr-lot">
                      <span className="muted">{item.lotLabel}</span>
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
            {items.length} {items.length === 1 ? "item" : "items"} · {units}{" "}
            {units === 1 ? "unit" : "units"}
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
