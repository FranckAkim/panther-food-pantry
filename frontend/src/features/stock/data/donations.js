export const initialDonations = [
  {
    id: "donation-1",
    donor: "Alumni food drive",
    received: "2026-10-09",
    lines: 4,
  },
  {
    id: "donation-2",
    donor: "Individual donor",
    received: "2026-10-06",
    lines: 1,
  },
  {
    id: "donation-3",
    donor: "Northside Community Church",
    received: "2026-09-28",
    lines: 5,
  },
  {
    id: "donation-4",
    donor: "Alumni food drive",
    received: "2026-09-12",
    lines: 6,
  },
  ...Array.from({ length: 24 }, (_, index) => {
    const donors = [
      "PVAMU student organization",
      "Prairie View community drive",
      "Campus faculty collection",
      "Local grocery partner",
      "Alumni food drive",
      "Individual donor",
    ];
    const foods = [
      ["black-beans", "Canned black beans"],
      ["rice", "White rice (2 lb)"],
      ["cereal", "Cereal"],
      ["spaghetti", "Spaghetti"],
      ["green-beans", "Canned green beans"],
    ];
    const received = `2026-${index < 12 ? "10" : "09"}-${String(1 + (index % 12)).padStart(2, "0")}`;
    const details = Array.from({ length: 2 + (index % 3) }, (_, offset) => {
      const [itemId, name] = foods[(index + offset) % foods.length];
      return {
        id: `demo-donation-line-${index}-${offset}`,
        itemId,
        name,
        quantity: 6 + ((index + offset) % 9),
        expiry: "2027-06-30",
        shelf: offset % 2 ? "B1" : "A2",
      };
    });
    return {
      id: `demo-donation-${index + 1}`,
      donor: donors[index % donors.length],
      donors: [donors[index % donors.length]],
      received,
      lines: details.length,
      units: details.reduce((total, line) => total + line.quantity, 0),
      details,
    };
  }),
];
