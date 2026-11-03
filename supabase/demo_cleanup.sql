-- Optional cleanup for records inserted by demo_seed.sql only.
-- Run after the classroom demo and before using the pantry with real students.
-- Fixed seed IDs, not editable names or locations, identify the fixtures.
-- Any extra lot or stock adjustment stops cleanup for review.
begin;

-- Prevent a concurrent stock operation between the safety check and deletion.
lock table public.inventory_items, public.inventory_lots, public.stock_adjustments
  in share row exclusive mode;

create temporary table demo_fixture_ids on commit drop as
with demo_catalog(name) as (
  values
    ('Canned black beans'), ('Canned green beans'), ('Canned corn'),
    ('Diced tomatoes'), ('Tomato sauce'), ('Kidney beans'), ('Chickpeas'),
    ('Lentil soup'), ('Canned peaches'), ('Canned pears'),
    ('Canned carrots'), ('Canned spinach'), ('Peanut butter'),
    ('Canned tuna'), ('Canned chicken'), ('Dried lentils'),
    ('Mixed nuts'), ('Sunflower butter'), ('White rice (2 lb)'),
    ('Brown rice'), ('Spaghetti'), ('Macaroni'), ('Penne pasta'),
    ('Whole-grain crackers'), ('Oatmeal'), ('Cereal'),
    ('Granola bars'), ('Pancake mix'), ('Shelf-stable milk'),
    ('Powdered milk'), ('Applesauce'), ('Raisins'), ('Toothpaste'),
    ('Soap'), ('Shampoo'), ('Toothbrushes')
)
select md5('panther-pantry-demo:item:' || name)::uuid as item_id,
       md5('panther-pantry-demo:lot:' || name || ':1')::uuid as lot_1_id,
       md5('panther-pantry-demo:lot:' || name || ':2')::uuid as lot_2_id
  from demo_catalog;

do $$
begin
  -- A new lot on a seeded item may contain real activity; do not delete it.
  if exists (
    select 1 from public.inventory_lots l
      join demo_fixture_ids d on d.item_id = l.item_id
     where l.id not in (d.lot_1_id, d.lot_2_id)
  ) then
    raise exception 'Demo items have additional lots; review them before cleanup';
  end if;

  -- A fixed lot ID must still belong to its original fixed item ID.
  if exists (
    select 1 from public.inventory_lots l
      join demo_fixture_ids d on l.id in (d.lot_1_id, d.lot_2_id)
     where l.item_id <> d.item_id
  ) then
    raise exception 'Demo lot ownership changed; review it before cleanup';
  end if;

  -- Exactly one initial ledger entry per lot, with no later stock activity.
  if exists (
    select 1 from public.inventory_lots l
      join demo_fixture_ids d on l.id in (d.lot_1_id, d.lot_2_id)
      left join public.stock_adjustments a on a.lot_id = l.id
     group by l.id, l.qty_on_hand
    having count(a.id) <> 1
        or count(a.id) filter (
             where a.reason = 'DEMO seed: initial stock for classroom walkthrough'
               and a.quantity_change = l.qty_on_hand
               and a.quantity_after = l.qty_on_hand
           ) <> 1
  ) then
    raise exception 'Demo lots have unexpected stock history; review it before cleanup';
  end if;
end;
$$;

delete from public.stock_adjustments a
 using demo_fixture_ids d
 where a.lot_id in (d.lot_1_id, d.lot_2_id);

delete from public.inventory_lots l
 using demo_fixture_ids d
 where l.id in (d.lot_1_id, d.lot_2_id);

delete from public.inventory_items i
 using demo_fixture_ids d
 where i.id = d.item_id;

commit;
