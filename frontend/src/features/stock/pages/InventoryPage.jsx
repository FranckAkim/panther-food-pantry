import { useState, useEffect } from "react";
import {
  lowStock,
  expiresSoon,
  expiringLotCount,
  quantityOf,
  nextExpiry,
} from "../utils/inventory.js";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import plusWhite from "../../../assets/stock-plus-white.svg";
import { Search } from "../components/Search.jsx";
import { Filter } from "../components/Filter.jsx";
import { categoryOptions } from "../categories.js";
import { createItem } from "../../../api/inventory.js";
import { savePhotoChange } from "../../../api/itemPhotos.js";
import { notifyError } from "../../../components/Notifications.jsx";
import { ItemPhoto } from "../../../components/ui/ItemPhoto.jsx";
import { affected } from "../../../api/keys.js";
import { useRefresh } from "../../../lib/queryClient.js";
import { StockTable } from "../components/StockTable.jsx";
import { LinkButton } from "../components/LinkButton.jsx";
import { dateText } from "../utils/formatters.js";
import { Status } from "../components/Status.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { ItemEditor } from "../components/ItemEditor.jsx";

export function InventoryPage({ items, showItem, notify }) {
  const refresh = useRefresh();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const filtered = items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) &&
      (!category || category === item.category) &&
      (filter === "all" || (filter === "low" ? lowStock(item) : expiresSoon(item))),
  );
  useEffect(() => setOffset(0), [query, category, filter]);
  const visible = filtered.slice(offset, offset + 11);
  return (
    <>
      <PageHeading
        title="Inventory"
        description={`${items.length} items · ${items.filter(lowStock).length} low stock · ${expiringLotCount(items)} lots expiring soon`}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Asset src={plusWhite} />
            Add item
          </Button>
        }
      />
      <div className="stock-toolbar">
        <Search value={query} onChange={setQuery} placeholder="Search items" />
        <div className="stock-filters" role="group" aria-label="Filter inventory">
          <Filter selected={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Filter>
          <Filter selected={filter === "low"} onClick={() => setFilter("low")}>
            Low stock · {items.filter(lowStock).length}
          </Filter>
          <Filter selected={filter === "expiry"} onClick={() => setFilter("expiry")}>
            Expires soon · {items.filter(expiresSoon).length}
          </Filter>
        </div>
        <select
          className="select stock-category"
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categoryOptions(items).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <>
        <StockTable className="stock-inventory-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th className="stock-number">On hand</th>
              <th className="stock-number">Alert at</th>
              <th>Next expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="stock-item-cell">
                    <ItemPhoto path={item.imagePath} />
                    <LinkButton underline onClick={() => showItem(item.id)}>
                      {item.name}
                    </LinkButton>
                  </span>
                </td>
                <td className="muted">{item.category}</td>
                <td className="stock-number">
                  {quantityOf(item)} {item.unit}
                </td>
                <td className="stock-number muted">{item.alert}</td>
                <td>{dateText(nextExpiry(item))}</td>
                <td>
                  <Status item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </StockTable>
        {!filtered.length && (
          <EmptyState title="No items found" description="Try another search or category." />
        )}
        <div className="stock-pagination">
          <span className="muted">
            {offset
              ? `Showing ${offset + 1}–${offset + visible.length}`
              : `Showing ${visible.length}`}{" "}
            of {filtered.length} items
          </span>
          <div className="stock-actions">
            <Button
              variant="secondary"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 11))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={offset + 11 >= filtered.length}
              onClick={() => setOffset(offset + 11)}
            >
              Next
            </Button>
          </div>
        </div>
      </>
      {adding && (
        <ItemEditor
          items={items}
          onClose={() => setAdding(false)}
          onSave={async (data) => {
            const created = await createItem(data);
            // The item exists now, so a failed upload must not keep the form open for a retry
            // (that would try to add the item twice). The photo can be added from the item page.
            let photoError = null;
            try {
              await savePhotoChange(created.id, data.photo);
            } catch (error) {
              photoError = error;
            }
            await refresh(affected.inventory);
            setAdding(false);
            if (photoError)
              notifyError(
                `${data.name} was added, but its photo wasn't saved: ${photoError.message} Use Edit item to try again.`,
              );
            else notify(`${data.name} added to inventory.`);
          }}
        />
      )}
    </>
  );
}
