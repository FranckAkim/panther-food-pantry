import { rpc, run, supabase } from "./client.js";
import { mapAdjustment, mapInventoryItem } from "./mappers.js";
import { pantryToday } from "./time.js";

const ITEM_COLUMNS = `id, name, category, unit, active, low_stock_threshold, image_path,
  inventory_lots(id, qty_on_hand, storage_location, received_date, expiry_date, received_quantity,
    donation_id, donation:donations(donation_donors(donor:donors(name))))`;

/** Staff: active items with their lots, sorted by name. */
export async function fetchInventory() {
  const rows = await run(
    supabase.from("inventory_items").select(ITEM_COLUMNS).eq("active", true).order("name"),
  );
  const today = pantryToday();
  return rows.map((row) => mapInventoryItem(row, today));
}

/** Staff: the ledger for one item, newest first. */
export async function fetchItemHistory(itemId) {
  const rows = await run(
    supabase
      .from("stock_adjustments")
      .select(
        "id, quantity_change, quantity_after, reason, kind, created_at, actor:profiles(display_name), lot:inventory_lots!inner(item_id, expiry_date)",
      )
      .eq("lot.item_id", itemId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  );
  return rows.map(mapAdjustment);
}

/** Any signed-in user: foods that can be requested now. */
export const fetchAvailableFoods = async () =>
  (await rpc("available_inventory")).map((row) => ({
    id: row.item_id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    imagePath: row.image_path || null,
  }));

/** Any signed-in user: In stock / Low stock / Out of stock per category. */
export const fetchCategoryAvailability = async () =>
  (await rpc("category_availability")).map((row) => ({
    category: row.category,
    status: { in_stock: "In stock", low_stock: "Low stock", out_of_stock: "Out of stock" }[
      row.status
    ],
  }));

export const createItem = ({ name, category, unit, alert, quantity, shelf, expiry }) =>
  rpc("staff_create_inventory_item", {
    p_name: name,
    p_category: category,
    p_unit: unit,
    p_low_stock_threshold: alert,
    p_quantity: quantity || 0,
    p_storage_location: shelf || null,
    p_expiry_date: expiry || null,
  });

export const updateItem = (itemId, { name, category, unit, alert }) =>
  rpc("staff_update_inventory_item", {
    p_item_id: itemId,
    p_name: name,
    p_category: category,
    p_unit: unit,
    p_low_stock_threshold: alert,
  });

/** Sets a lot to a counted quantity; the server records the difference in the ledger. */
export const setLotQuantity = (lotId, quantity, reason) =>
  rpc("staff_set_lot_quantity", { p_lot_id: lotId, p_quantity: quantity, p_reason: reason });

/** Adds a new lot of stock (not from a donation). */
export const addLot = (itemId, { quantity, shelf, expiry }) =>
  rpc("create_inventory_lot", {
    p_item_id: itemId,
    p_quantity: quantity,
    p_storage_location: shelf,
    p_received_date: pantryToday(),
    p_expiry_date: expiry || null,
  });
