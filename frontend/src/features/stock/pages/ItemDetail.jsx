import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { StockTable } from "../components/StockTable.jsx";
import { LinkButton } from "../components/LinkButton.jsx";
import { Status } from "../components/Status.jsx";
import { ItemEditor } from "../components/ItemEditor.jsx";
import { AdjustStock } from "../components/AdjustStock.jsx";
import { AddStock } from "../components/AddStock.jsx";
import { dateText } from "../utils/formatters.js";
import { expiredQuantity, nextExpiry, quantityOf } from "../utils/inventory.js";
import { addLot, fetchItemHistory, setLotQuantity, updateItem } from "../../../api/inventory.js";
import { savePhotoChange } from "../../../api/itemPhotos.js";
import { ItemPhoto } from "../../../components/ui/ItemPhoto.jsx";
import { affected, keys } from "../../../api/keys.js";
import { useRefresh } from "../../../lib/queryClient.js";

export function ItemDetail({ item, items, navigate, notify }) {
  const refresh = useRefresh();
  const history = useQuery({
    queryKey: keys.itemHistory(item.id),
    queryFn: () => fetchItemHistory(item.id),
  });
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [adding, setAdding] = useState(false);
  // Lots with stock, soonest expiry first (the order the server hands them out).
  const lots = item.lots.filter((lot) => lot.quantity > 0);
  const expired = expiredQuantity(item);
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
            <ItemPhoto path={item.imagePath} className="stock-title-photo" />
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
            <Button variant="secondary" onClick={() => setAdding(true)}>
              Add stock
            </Button>
            {lots.length > 0 && (
              <Button onClick={() => setAdjusting(lots[0].id)}>Adjust stock</Button>
            )}
          </>
        }
      />
      <div className="stock-summary">
        {[
          ["On hand", quantityOf(item), item.unit],
          ["Low-stock alert at", item.alert, item.unit],
          ["Lots", lots.length, ""],
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
      {expired > 0 && (
        <p className="notice">
          {expired} expired {item.unit} still on the shelf. They are not handed out; adjust the lot
          to 0 when they are removed.
        </p>
      )}
      <Card className="stock-section">
        <div className="stock-section-header">
          <h2>Lots</h2>
          <p>
            A lot is one delivery with its own expiry date and shelf. The lot that expires first
            goes out first.
          </p>
        </div>
        {lots.length ? (
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
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <span className="stock-lot-expiry">
                      {lot.expiry ? dateText(lot.expiry) : "No expiry"}
                      {lot.expired ? (
                        <Badge tone="warning">Expired</Badge>
                      ) : (
                        lot.id === item.nextLot?.id && <Badge tone="purple">Goes out next</Badge>
                      )}
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
        ) : (
          <div className="stock-section-empty muted">
            No stock on hand. Record a donation or use “Add stock”.
          </div>
        )}
      </Card>
      <Card className="stock-section">
        <div className="stock-section-header">
          <h2>Stock changes</h2>
        </div>
        <DataLoader queries={history} label="Loading stock changes…" compact>
          {history.data?.length ? (
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
                {history.data.map((change) => (
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
        </DataLoader>
      </Card>
      {editing && (
        <ItemEditor
          item={item}
          items={items}
          onClose={() => setEditing(false)}
          onSave={async (data) => {
            await updateItem(item.id, data);
            await savePhotoChange(item.id, data.photo);
            await refresh(affected.inventory);
            setEditing(false);
            notify("Item updated.");
          }}
        />
      )}
      {adjusting && (
        <AdjustStock
          item={item}
          lots={lots}
          initialLot={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={async (lotId, quantity, reason) => {
            await setLotQuantity(lotId, quantity, reason);
            await refresh(affected.inventory);
            setAdjusting(null);
            notify("Stock adjustment recorded.");
          }}
        />
      )}
      {adding && (
        <AddStock
          item={item}
          onClose={() => setAdding(false)}
          onSave={async (lot) => {
            await addLot(item.id, lot);
            await refresh(affected.inventory);
            setAdding(false);
            notify(`${lot.quantity} ${item.unit} added to ${item.name}.`);
          }}
        />
      )}
    </>
  );
}
