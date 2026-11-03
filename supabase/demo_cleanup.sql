-- Optional cleanup for records inserted by demo_seed.sql only.
-- Run after the classroom demo and before using the pantry with real students.
-- Stops if a demo lot has later stock activity, so that activity can be reviewed first.
begin;

do $$
begin
  if exists (
    select 1
      from public.stock_adjustments a
      join public.inventory_lots l on l.id = a.lot_id
      join public.inventory_items i on i.id = l.item_id
     where i.name like '[DEMO] %'
       and i.id = md5('panther-pantry-demo:item:' || substring(i.name from 8))::uuid
       and l.storage_location like 'DEMO-%'
       and a.reason <> 'DEMO seed: initial stock for classroom walkthrough'
  ) then
    raise exception 'Demo lots have later stock activity; review it before cleanup';
  end if;
end;
$$;

delete from public.stock_adjustments a
 using public.inventory_lots l, public.inventory_items i
 where a.lot_id = l.id
   and l.item_id = i.id
   and i.name like '[DEMO] %'
   and i.id = md5('panther-pantry-demo:item:' || substring(i.name from 8))::uuid
   and l.storage_location like 'DEMO-%'
   and a.reason = 'DEMO seed: initial stock for classroom walkthrough';

delete from public.inventory_lots l
 using public.inventory_items i
 where l.item_id = i.id
   and i.name like '[DEMO] %'
   and i.id = md5('panther-pantry-demo:item:' || substring(i.name from 8))::uuid
   and l.storage_location like 'DEMO-%';

delete from public.inventory_items i
 where i.name like '[DEMO] %'
   and i.id = md5('panther-pantry-demo:item:' || substring(i.name from 8))::uuid;

commit;
