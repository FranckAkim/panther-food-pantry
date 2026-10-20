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
import { categories } from "../data/inventory.js";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { StockTable } from "../components/StockTable.jsx";
import { LinkButton } from "../components/LinkButton.jsx";
import { dateText, id, today } from "../utils/formatters.js";
import { Status } from "../components/Status.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { ItemEditor } from "../components/ItemEditor.jsx";

export function InventoryPage({ items, setItems, showItem, notify }) {
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
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <DataLoader
        queryKey={JSON.stringify([query, filter, category, offset])}
        initialLoading={false}
        label="Loading inventory…"
      >
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
                  <LinkButton underline onClick={() => showItem(item.id)}>
                    {item.name}
                  </LinkButton>
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
      </DataLoader>
      {adding && (
        <ItemEditor
          onClose={() => setAdding(false)}
          onSave={(data) => {
            const itemId = id();
            const newItem = {
              ...data,
              id: itemId,
              changes: [],
              lots: [
                {
                  id: id(),
                  quantity: data.quantity,
                  expiry: data.expiry,
                  shelf: data.shelf,
                  received: today(),
                  source: "Initial stock",
                },
              ],
            };
            setItems((old) => [...old, newItem]);
            setAdding(false);
            notify(`${data.name} added to inventory.`);
          }}
        />
      )}
    </>
  );
}
