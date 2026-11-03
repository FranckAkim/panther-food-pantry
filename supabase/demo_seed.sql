-- Optional, idempotent demo data for the shared classroom project.
-- Run once through the Supabase SQL editor or connector; this is not a migration.
-- All seeded item names and lot locations are marked DEMO for easy identification.
-- Existing inventory and student records are not changed.
with demo_catalog(name, category, unit, base_qty, zone) as (
  values
    ('Canned black beans', 'Canned goods', 'can', 36, 'A1'),
    ('Canned green beans', 'Canned goods', 'can', 28, 'A1'),
    ('Canned corn', 'Canned goods', 'can', 32, 'A1'),
    ('Diced tomatoes', 'Canned goods', 'can', 24, 'A2'),
    ('Tomato sauce', 'Canned goods', 'can', 26, 'A2'),
    ('Kidney beans', 'Canned goods', 'can', 30, 'A2'),
    ('Chickpeas', 'Canned goods', 'can', 20, 'A2'),
    ('Lentil soup', 'Canned goods', 'can', 18, 'A3'),
    ('Canned peaches', 'Canned goods', 'can', 22, 'A3'),
    ('Canned pears', 'Canned goods', 'can', 16, 'A3'),
    ('Canned carrots', 'Canned goods', 'can', 19, 'A3'),
    ('Canned spinach', 'Canned goods', 'can', 15, 'A3'),
    ('Peanut butter', 'Protein', 'jar', 14, 'B1'),
    ('Canned tuna', 'Protein', 'can', 25, 'B1'),
    ('Canned chicken', 'Protein', 'can', 21, 'B1'),
    ('Dried lentils', 'Protein', 'bag', 18, 'B1'),
    ('Mixed nuts', 'Protein', 'bag', 12, 'B2'),
    ('Sunflower butter', 'Protein', 'jar', 10, 'B2'),
    ('White rice (2 lb)', 'Grains and pasta', 'bag', 31, 'C1'),
    ('Brown rice', 'Grains and pasta', 'bag', 23, 'C1'),
    ('Spaghetti', 'Grains and pasta', 'box', 29, 'C1'),
    ('Macaroni', 'Grains and pasta', 'box', 21, 'C2'),
    ('Penne pasta', 'Grains and pasta', 'box', 18, 'C2'),
    ('Whole-grain crackers', 'Grains and pasta', 'box', 14, 'C2'),
    ('Oatmeal', 'Breakfast', 'canister', 22, 'D1'),
    ('Cereal', 'Breakfast', 'box', 17, 'D1'),
    ('Granola bars', 'Breakfast', 'box', 26, 'D1'),
    ('Pancake mix', 'Breakfast', 'box', 13, 'D2'),
    ('Shelf-stable milk', 'Dairy', 'carton', 24, 'D2'),
    ('Powdered milk', 'Dairy', 'box', 11, 'D2'),
    ('Applesauce', 'Produce', 'jar', 18, 'E1'),
    ('Raisins', 'Produce', 'bag', 16, 'E1'),
    ('Toothpaste', 'Personal care', 'tube', 20, 'F1'),
    ('Soap', 'Personal care', 'bar', 30, 'F1'),
    ('Shampoo', 'Personal care', 'bottle', 13, 'F2'),
    ('Toothbrushes', 'Personal care', 'pack', 19, 'F2')
),
new_items as (
  insert into public.inventory_items(id, name, category, unit, active)
  select md5('panther-pantry-demo:item:' || name)::uuid,
         '[DEMO] ' || name, category, unit, true
    from demo_catalog
  on conflict (id) do nothing
  returning id
),
new_lots as (
  insert into public.inventory_lots
    (id, item_id, qty_on_hand, storage_location, received_date, expiry_date)
  select md5('panther-pantry-demo:lot:' || c.name || ':' || batch.n)::uuid,
         md5('panther-pantry-demo:item:' || c.name)::uuid,
         case when batch.n = 1 then c.base_qty else greatest(4, c.base_qty / 2) end,
         'DEMO-' || c.zone || '-' || batch.n,
         case when batch.n = 1 then date '2026-10-20' else date '2026-10-27' end,
         case when batch.n = 1 then date '2027-02-15' else date '2027-08-15' end
    from demo_catalog c
    cross join (values (1), (2)) as batch(n)
  on conflict (id) do nothing
  returning id, qty_on_hand
),
new_adjustments as (
  insert into public.stock_adjustments
    (lot_id, quantity_change, quantity_after, reason, actor_id)
  select l.id, l.qty_on_hand, l.qty_on_hand,
         'DEMO seed: initial stock for classroom walkthrough',
         (select p.id from public.profiles p
           join private.user_access a on a.user_id = p.id
           where a.role = 'admin' and a.enabled limit 1)
    from new_lots l
  returning id
)
select (select count(*) from new_items) as items_added,
       (select count(*) from new_lots) as lots_added,
       (select count(*) from new_adjustments) as stock_history_added;
