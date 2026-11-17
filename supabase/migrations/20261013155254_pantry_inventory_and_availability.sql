-- PFPMS-9 inventory and PFPMS-25 minimal student-facing availability.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  unit text not null default 'each' check (char_length(btrim(unit)) between 1 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id),
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  storage_location text not null check (char_length(btrim(storage_location)) between 1 and 100),
  received_date date not null,
  expiry_date date,
  created_at timestamptz not null default now(),
  check (expiry_date is null or expiry_date >= received_date)
);
create index inventory_lots_item_idx on public.inventory_lots(item_id);
create index inventory_lots_expiry_idx on public.inventory_lots(expiry_date);
create table public.stock_adjustments (
  id bigint generated always as identity primary key,
  lot_id uuid not null references public.inventory_lots(id),
  quantity_change integer not null,
  quantity_after integer not null check (quantity_after >= 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index stock_adjustments_lot_idx on public.stock_adjustments(lot_id);
create index stock_adjustments_actor_idx on public.stock_adjustments(actor_id);
alter table public.inventory_items enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.stock_adjustments enable row level security;
create policy items_read on public.inventory_items for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy items_insert on public.inventory_items for insert to authenticated
with check ((select private.current_role()) in ('staff','admin'));
create policy items_update on public.inventory_items for update to authenticated
using ((select private.current_role()) in ('staff','admin'))
with check ((select private.current_role()) in ('staff','admin'));
create policy lots_read on public.inventory_lots for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy lots_update on public.inventory_lots for update to authenticated
using ((select private.current_role()) in ('staff','admin'))
with check ((select private.current_role()) in ('staff','admin'));
create policy adjustments_read on public.stock_adjustments for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
revoke all on public.inventory_items, public.inventory_lots, public.stock_adjustments from anon, authenticated;
grant select on public.inventory_items, public.inventory_lots, public.stock_adjustments to authenticated;
grant insert(name, category, unit, active), update(name, category, unit, active) on public.inventory_items to authenticated;
grant update(storage_location, received_date, expiry_date) on public.inventory_lots to authenticated;

create function private.create_lot(p_item_id uuid, p_quantity integer, p_storage_location text,
  p_received_date date, p_expiry_date date) returns public.inventory_lots
language plpgsql security definer set search_path = '' as $$
declare created public.inventory_lots;
begin
  if private.current_role() is null or private.current_role() not in ('staff','admin') then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Quantity must be a nonnegative whole number' using errcode='22023';
  end if;
  if not exists(select 1 from public.inventory_items where id=p_item_id and active) then
    raise exception 'Active inventory item required' using errcode='22023';
  end if;
  insert into public.inventory_lots(item_id,qty_on_hand,storage_location,received_date,expiry_date)
    values(p_item_id,p_quantity,p_storage_location,p_received_date,p_expiry_date) returning * into created;
  insert into public.stock_adjustments(lot_id,quantity_change,quantity_after,reason,actor_id)
    values(created.id,p_quantity,p_quantity,'Initial stock',auth.uid());
  return created;
end;
$$;
create function public.create_inventory_lot(p_item_id uuid, p_quantity integer, p_storage_location text,
  p_received_date date, p_expiry_date date default null) returns public.inventory_lots
language sql security invoker set search_path = '' as $$
  select private.create_lot(p_item_id,p_quantity,p_storage_location,p_received_date,p_expiry_date);
$$;

create function private.adjust_stock(p_lot_id uuid, p_delta integer, p_reason text) returns public.inventory_lots
language plpgsql security definer set search_path = '' as $$
declare lot public.inventory_lots;
begin
  if private.current_role() is null or private.current_role() not in ('staff','admin') then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if p_delta is null or p_delta=0 then raise exception 'A nonzero stock change is required' using errcode='22023'; end if;
  select * into lot from public.inventory_lots where id=p_lot_id for update;
  if not found then raise exception 'Lot not found' using errcode='P0002'; end if;
  if lot.qty_on_hand::bigint + p_delta::bigint < 0 or lot.qty_on_hand::bigint + p_delta::bigint > 2147483647 then
    raise exception 'Stock change exceeds quantity limits' using errcode='23514';
  end if;
  update public.inventory_lots set qty_on_hand=qty_on_hand+p_delta where id=p_lot_id returning * into lot;
  insert into public.stock_adjustments(lot_id,quantity_change,quantity_after,reason,actor_id)
    values(lot.id,p_delta,lot.qty_on_hand,p_reason,auth.uid());
  return lot;
end;
$$;
create function public.adjust_inventory_stock(p_lot_id uuid, p_delta integer, p_reason text) returns public.inventory_lots
language sql security invoker set search_path = '' as $$ select private.adjust_stock(p_lot_id,p_delta,p_reason); $$;

create function private.available_inventory() returns table(item_id uuid, name text, category text, unit text, available boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
  return query select i.id,i.name,i.category,i.unit,true from public.inventory_items i
    where i.active and exists(select 1 from public.inventory_lots l where l.item_id=i.id and l.qty_on_hand>0
      and l.received_date<=current_date and (l.expiry_date is null or l.expiry_date>=current_date)) order by i.name;
end;
$$;
create function public.available_inventory() returns table(item_id uuid, name text, category text, unit text, available boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.available_inventory(); $$;
revoke all on function private.create_lot(uuid,integer,text,date,date),public.create_inventory_lot(uuid,integer,text,date,date),
  private.adjust_stock(uuid,integer,text),public.adjust_inventory_stock(uuid,integer,text),
  private.available_inventory(),public.available_inventory() from public, anon;
grant execute on function private.create_lot(uuid,integer,text,date,date),public.create_inventory_lot(uuid,integer,text,date,date),
  private.adjust_stock(uuid,integer,text),public.adjust_inventory_stock(uuid,integer,text),
  private.available_inventory(),public.available_inventory() to authenticated;
