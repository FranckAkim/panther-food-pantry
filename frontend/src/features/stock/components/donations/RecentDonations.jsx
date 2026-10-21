import { Card } from "../../../../components/ui/Card.jsx";
import { dateText } from "../../utils/formatters.js";

export function RecentDonations({ donations, setViewing }) {
  return (
    <Card className="stock-recent">
      <h2>Recent donations</h2>
      {donations.slice(0, 8).map((donation) => (
        <button
          key={donation.id}
          type="button"
          className="stock-recent-entry"
          onClick={() => setViewing(donation)}
        >
          <span>{donation.donor}</span>
          <span className="muted">
            {dateText(donation.received, false)} · {donation.lines}{" "}
            {donation.lines === 1 ? "item" : "items"}
          </span>
        </button>
      ))}
    </Card>
  );
}
