import { Modal } from "../../../../components/ui/Modal.jsx";
import { Button } from "../../../../components/ui/Button.jsx";
import { quantityText } from "../../../../api/mappers.js";
import { dateText } from "../../utils/formatters.js";
import { ItemPhoto } from "../../../../components/ui/ItemPhoto.jsx";

export function DonationDetailsDialog({ viewing, setViewing }) {
  return (
    <Modal
      title={viewing.donor}
      onClose={() => setViewing(null)}
      footer={
        <Button variant="secondary" onClick={() => setViewing(null)}>
          Close
        </Button>
      }
    >
      <>
        <p className="muted">
          Received {dateText(viewing.received)} · {viewing.lines}{" "}
          {viewing.lines === 1 ? "item" : "items"}
        </p>
        {viewing.details.length ? (
          <ul className="stock-donation-details">
            {viewing.details.map((line) => (
              <li key={line.id}>
                <ItemPhoto path={line.imagePath} />
                <div>
                  <strong>{line.name}</strong>
                  <span>
                    {quantityText(line.quantity, line.unit)} · Shelf {line.shelf}
                  </span>
                  <span className="muted">
                    {line.expiry ? `Expires ${dateText(line.expiry)}` : "No expiry date"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No items are recorded for this donation.</p>
        )}
      </>
    </Modal>
  );
}
