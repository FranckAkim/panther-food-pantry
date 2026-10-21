export const categories = [
  "Canned goods",
  "Protein",
  "Grains and pasta",
  "Breakfast",
  "Dairy",
  "Produce",
  "Personal care",
];

const initialRows = [
  ["black-beans", "Canned black beans", "Canned goods", 48, "cans", 20, "2026-11-02"],
  ["green-beans", "Canned green beans", "Canned goods", 36, "cans", 20, "2027-01-15"],
  ["chicken-soup", "Chicken noodle soup", "Canned goods", 22, "cans", 15, "2026-10-20"],
  ["tuna", "Canned tuna", "Protein", 11, "cans", 20, "2027-04-03"],
  ["peanut-butter", "Peanut butter", "Protein", 6, "jars", 15, "2026-12-05"],
  ["rice", "White rice (2 lb)", "Grains and pasta", 30, "bags", 10, "2027-03-01"],
  ["spaghetti", "Spaghetti", "Grains and pasta", 27, "boxes", 10, "2027-02-10"],
  ["cereal", "Cereal", "Breakfast", 9, "boxes", 12, "2026-11-30"],
  ["oatmeal", "Oatmeal", "Breakfast", 14, "canisters", 8, "2027-01-22"],
  ["milk", "Shelf-stable milk", "Dairy", 8, "cartons", 20, "2026-10-18"],
  ["apples", "Apples", "Produce", 12, "lb", 10, "2026-10-17"],
];

const additionalRows = [
  ["Canned corn", "Canned goods", "cans"],
  ["Diced tomatoes", "Canned goods", "cans"],
  ["Tomato sauce", "Canned goods", "cans"],
  ["Kidney beans", "Canned goods", "cans"],
  ["Chickpeas", "Canned goods", "cans"],
  ["Lentil soup", "Canned goods", "cans"],
  ["Canned peaches", "Canned goods", "cans"],
  ["Canned pears", "Canned goods", "cans"],
  ["Canned chicken", "Protein", "cans"],
  ["Dried lentils", "Protein", "bags"],
  ["Mixed nuts", "Protein", "bags"],
  ["Sunflower butter", "Protein", "jars"],
  ["Brown rice", "Grains and pasta", "bags"],
  ["Macaroni", "Grains and pasta", "boxes"],
  ["Penne pasta", "Grains and pasta", "boxes"],
  ["Whole-wheat pasta", "Grains and pasta", "boxes"],
  ["Couscous", "Grains and pasta", "boxes"],
  ["Flour", "Grains and pasta", "bags"],
  ["Granola bars", "Breakfast", "boxes"],
  ["Pancake mix", "Breakfast", "boxes"],
  ["Instant oatmeal", "Breakfast", "boxes"],
  ["Raisins", "Produce", "bags"],
  ["Applesauce", "Produce", "jars"],
  ["Powdered milk", "Dairy", "boxes"],
  ["Toothpaste", "Personal care", "tubes"],
  ["Soap", "Personal care", "bars"],
  ["Shampoo", "Personal care", "bottles"],
];

export const initialItems = [
  ...initialRows,
  ...additionalRows.map(([name, category, unit], i) => [
    `other-${i}`,
    name,
    category,
    25 + i,
    unit,
    10,
    "2027-05-01",
  ]),
].map(([id, name, category, quantity, unit, alert, expiry]) => ({
  id,
  name,
  category,
  unit,
  alert,
  lots:
    id === "black-beans"
      ? [
          {
            id: "beans-1",
            expiry: "2026-11-02",
            received: "2026-09-12",
            shelf: "A2",
            quantity: 13,
            source: "Donation · Alumni food drive",
          },
          {
            id: "beans-2",
            expiry: "2027-02-14",
            received: "2026-09-28",
            shelf: "A2",
            quantity: 23,
            source: "Donation · Northside Community Church",
          },
          {
            id: "beans-3",
            expiry: "2027-06-30",
            received: "2026-10-06",
            shelf: "A3",
            quantity: 12,
            source: "Purchased",
          },
        ]
      : id === "chicken-soup"
        ? [
            {
              id: "chicken-soup-1",
              expiry: "2026-10-20",
              received: "2026-10-06",
              shelf: "A3",
              quantity: 10,
              source: "Donation",
            },
            {
              id: "chicken-soup-2",
              expiry: "2027-01-20",
              received: "2026-10-09",
              shelf: "A3",
              quantity: 12,
              source: "Donation",
            },
          ]
        : [
            {
              id: `${id}-1`,
              expiry,
              received: "2026-10-06",
              shelf:
                { rice: "B1", spaghetti: "B2", milk: "C1", apples: "Cooler" }[id] ||
                (category === "Grains and pasta" ? "B2" : "A2"),
              quantity,
              source: "Donation",
            },
          ],
  changes:
    id === "black-beans"
      ? [
          {
            id: "change-1",
            when: "Oct 14, 10:12 AM",
            change: -2,
            reason: "Distribution",
            lot: "Expires Nov 2",
            by: "Dana Carter",
          },
          {
            id: "change-2",
            when: "Oct 13, 1:40 PM",
            change: -4,
            reason: "Distribution",
            lot: "Expires Nov 2",
            by: "Dana Carter",
          },
          {
            id: "change-3",
            when: "Oct 9, 3:15 PM",
            change: -1,
            reason: "Adjustment · dented can",
            lot: "Expires Feb 14",
            by: "Luis Ramirez",
          },
          {
            id: "change-4",
            when: "Sep 28, 11:02 AM",
            change: 24,
            reason: "Donation",
            lot: "Expires Feb 14",
            by: "Luis Ramirez",
          },
        ]
      : [],
}));
