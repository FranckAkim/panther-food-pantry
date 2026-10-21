import { useState } from "react";
import { LinkButton } from "../components/LinkButton.jsx";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Status } from "../components/Status.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { quantityOf, nextExpiry } from "../utils/inventory.js";
import { dateText, id, actionTime } from "../utils/formatters.js";
import { Card } from "../../../components/ui/Card.jsx";
import { StockTable } from "../components/StockTable.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { ItemEditor } from "../components/ItemEditor.jsx";
import { AdjustStock } from "../components/AdjustStock.jsx";

export function ItemDetail({ item, setItems, navigate, notify }) {
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const lots = [...item.lots].sort((a, b) =>
    (a.expiry || "9999").localeCompare(b.expiry || "9999"),
  );
  return (
    <>
      <div className="stock-breadcrumb">
        <LinkButton underline onClick={() => navigate("/staff/inventory")}>
          Inventory
        </LinkButton>
        <span>/ {item.name}</span>
      </div>
      <PageHeading
        title={
          <span className="stock-title-status">
            {item.name}
            <Status item={item} />
          </span>
        }
        description={`${item.category} · counted in ${item.unit}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit item
            </Button>
            <Button onClick={() => setAdjusting(lots[0]?.id || "new")}>Adjust stock</Button>
          </>
        }
      />
      <div className="stock-summary">
        {[
          ["On hand", quantityOf(item), item.unit],
          ["Low-stock alert at", item.alert, item.unit],
          ["Lots", item.lots.length, ""],
          ["Next expiry", dateText(nextExpiry(item), false), ""],
        ].map(([label, value, unit]) => (
          <Card key={label}>
            <span className="muted">{label}</span>
            <div className="stock-stat-value">
              {value} {unit && <span>{unit}</span>}
            </div>
          </Card>
        ))}
      </div>
      <Card className="stock-section">
        <div className="stock-section-header">
          <h2>Lots</h2>
          <p>
            A lot is one delivery with its own expiry date and shelf. The lot that expires first
            goes out first.
          </p>
        </div>
        <StockTable className="stock-lots-table">
          <thead>
            <tr>
              <th>Expires</th>
              <th>Received</th>
              <th>Shelf</th>
              <th className="stock-number">On hand</th>
              <th>Source</th>
              <th>
                <span className="stock-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot, index) => (
              <tr key={lot.id}>
                <td>
                  <span className="stock-lot-expiry">
                    {dateText(lot.expiry)}
                    {index === 0 && lot.quantity > 0 && <Badge tone="purple">Goes out next</Badge>}
                  </span>
                </td>
                <td className="muted">{dateText(lot.received)}</td>
                <td>{lot.shelf}</td>
                <td className="stock-number">{lot.quantity}</td>
                <td>{lot.source}</td>
                <td>
                  <LinkButton onClick={() => setAdjusting(lot.id)}>Adjust</LinkButton>
                </td>
              </tr>
            ))}
          </tbody>
        </StockTable>
      </Card>
      <Card className="stock-section">
        <div className="stock-section-header">
          <h2>Stock changes</h2>
        </div>
        {item.changes.length ? (
          <StockTable>
            <thead>
              <tr>
                <th>When</th>
                <th className="stock-number">Change</th>
                <th>Reason</th>
                <th>Lot</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {item.changes.map((change) => (
                <tr key={change.id}>
                  <td className="muted">{change.when}</td>
                  <td
                    className={`stock-number ${change.change > 0 ? "stock-positive" : "stock-negative"}`}
                  >
                    {change.change > 0 ? "+" : "−"}
                    {Math.abs(change.change)}
                  </td>
                  <td>{change.reason}</td>
                  <td>{change.lot}</td>
                  <td>{change.by}</td>
                </tr>
              ))}
            </tbody>
          </StockTable>
        ) : (
          <div className="stock-section-empty muted">No stock changes recorded yet.</div>
        )}
      </Card>
      {editing && (
        <ItemEditor
          item={item}
          onClose={() => setEditing(false)}
          onSave={(data) => {
            setItems((old) => old.map((i) => (i.id === item.id ? { ...i, ...data } : i)));
            setEditing(false);
            notify("Item updated.");
          }}
        />
      )}
      {adjusting && (
        <AdjustStock
          item={item}
          initialLot={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={(lotId, quantity, reason) => {
            const lot = item.lots.find((l) => l.id === lotId);
            const change = quantity - lot.quantity;
            setItems((old) =>
              old.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      lots: i.lots.map((l) => (l.id === lotId ? { ...l, quantity } : l)),
                      changes: [
                        {
                          id: id(),
                          when: actionTime(),
                          change,
                          reason: `Adjustment · ${reason}`,
                          lot: `Expires ${dateText(lot.expiry, false)}`,
                          by: "Dana Carter",
                        },
                        ...i.changes,
                      ],
                    }
                  : i,
              ),
            );
            setAdjusting(null);
            notify("Stock adjustment recorded.");
          }}
        />
      )}
    </>
  );
}
