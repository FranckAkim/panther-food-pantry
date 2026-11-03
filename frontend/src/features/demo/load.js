import { readValue, persistMockValue } from "../../lib/mockStorage.js";
import { initialRequests, initialPickups } from "../operations/data.js";
import { initialItems } from "../stock/data/inventory.js";
import { initialStudents } from "../stock/data/students.js";
import { initialDonations } from "../stock/data/donations.js";
import { initialSlots } from "../stock/data/pickupSlots.js";
import { auditKey, initialAuditLog } from "../admin/audit/data.js";

const marker = "panther-expanded-demo-v1";

// Add new fictional records to existing browser demos without replacing a team's edits.
export function loadExpandedDemoData() {
  try {
    if (localStorage.getItem(marker)) return;
    for (const [key, seed] of [
      ["panther-staff-requests", initialRequests],
      ["panther-staff-pickups", initialPickups],
      ["panther-inventory-v1", initialItems],
      ["panther-students-v1", initialStudents],
      ["panther-donations-v1", initialDonations],
      ["panther-pickup-slots-v1", initialSlots],
      [auditKey, initialAuditLog],
    ]) {
      if (localStorage.getItem(key) === null) continue;
      const saved = readValue(key, []);
      if (!Array.isArray(saved)) continue;
      const ids = new Set(saved.map((record) => record.id));
      const additions = seed.filter((record) => !ids.has(record.id));
      if (additions.length) persistMockValue(key, [...saved, ...additions]);
    }
    localStorage.setItem(marker, "loaded");
  } catch {
    // Private browsing can block storage; component defaults still contain the records.
  }
}
