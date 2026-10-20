import { Modal } from "../../../../components/ui/Modal.jsx";
import { Button } from "../../../../components/ui/Button.jsx";
import { DataLoader } from "../../../../components/loading/DataLoader.jsx";
import { dateText } from "../../utils/formatters.js";

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
      <DataLoader queryKey={viewing.id} label="Loading donation…" compact>
        <p className="muted">
          Received {dateText(viewing.received)} · {viewing.lines}{" "}
          {viewing.lines === 1 ? "item" : "items"}
        </p>
        {viewing.details ? (
          <ul className="stock-donation-details">
            {viewing.details.map((line) => (
              <li key={line.id}>
                <strong>{line.name}</strong>
                <span>
                  {line.quantity} units · Shelf {line.shelf}
                </span>
                <span className="muted">Expires {dateText(line.expiry)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Recorded donation. Individual item details are available in the corresponding inventory
            lots.
          </p>
        )}
      </DataLoader>
    </Modal>
  );
}
