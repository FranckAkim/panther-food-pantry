export const auditKey = "panther-audit-log-v1";

const auditExamples = [
  [
    "12:41",
    "Dana Carter",
    "Request approved",
    "Request #1044 · Olivia Reed",
    "Submitted → Approved",
  ],
  [
    "12:20",
    "Dana Carter",
    "Request declined",
    "Request #1043 · Ethan Cole",
    "Submitted → Declined",
  ],
  [
    "11:52",
    "Luis Ramirez",
    "Donation recorded",
    "Donation #311 · Northside Community Church",
    "3 lots added",
  ],
  [
    "11:12",
    "Dana Carter",
    "Pickup completed",
    "Request #1038 · Kevin Nguyen",
    "Approved → Completed",
  ],
  [
    "10:21",
    "Dana Carter",
    "Pickup completed",
    "Request #1031 · Andre Williams",
    "Approved → Completed",
  ],
  [
    "10:08",
    "Dana Carter",
    "Pickup completed",
    "Request #1029 · Maya Thompson",
    "Approved → Completed",
  ],
  [
    "10:02",
    "Luis Ramirez",
    "Provisional profile created",
    "Student · Darius King",
    "ID card checked",
  ],
  ["09:15", "Taylor Brooks", "Account deactivated", "User · Sam Okafor", "Active → Inactive"],
];

export const initialAuditLog = [
  ...auditExamples.map(([time, actor, action, record, change], i) => ({
    id: `audit-seed-${i}`,
    timestamp: `2026-10-14T${time}:00-05:00`,
    actor,
    action,
    record,
    change,
  })),
  ...Array.from({ length: 44 }, (_, i) => ({
    id: `audit-history-${i}`,
    timestamp: new Date(Date.parse("2026-10-14T09:10:00-05:00") - i * 60000).toISOString(),
    actor: i % 2 ? "Dana Carter" : "Luis Ramirez",
    action: "Stock adjusted",
    record: `Inventory · ${["Canned black beans", "White rice (2 lb)", "Spaghetti", "Cereal"][i % 4]}`,
    change: `${24 + i} → ${23 + i} units · Stock count correction`,
  })),
];
