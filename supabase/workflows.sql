-- Additive upgrade after schema.sql, request_validation.sql, and inventory.sql.
-- Operational writes are transactions; the browser never writes stock or statuses.
begin;
create table public.pickup_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 1000),
  active boolean not null default true
);
alter table public.food_requests add column slot_id uuid references public.pickup_slots(id),
  add column decision_note text not null default '' check (length(decision_note)<=500),
  add column completed_at timestamptz;
create index food_requests_slot_idx on public.food_requests(slot_id);
create table public.donations (
  id uuid primary key,
  donor text not null check (length(btrim(donor)) between 1 and 200),
  received_date date not null,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.donation_lines (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id),
  lot_id uuid not null unique references public.inventory_lots(id),
  quantity integer not null check (quantity>0)
);
create index donation_lines_donation_idx on public.donation_lines(donation_id);
create table public.pickup_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.food_requests(id),
  lot_id uuid not null references public.inventory_lots(id),
  quantity integer not null check (quantity>0),
  unique(request_id,lot_id)
);
create table public.operations_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  record_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.pickup_slots enable row level security;
alter table public.donations enable row level security;
alter table public.donation_lines enable row level security;
alter table public.pickup_lines enable row level security;
alter table public.operations_audit enable row level security;
revoke all on public.pickup_slots,public.donations,public.donation_lines,public.pickup_lines,public.operations_audit from public,anon,authenticated;
grant select on public.pickup_slots,public.donations,public.donation_lines,public.pickup_lines,public.operations_audit to authenticated;
create policy slots_read on public.pickup_slots for select to authenticated using ((select private.current_role()) is not null);
create policy donations_read on public.donations for select to authenticated using ((select private.current_role()) in ('staff','admin'));
create policy donation_lines_read on public.donation_lines for select to authenticated using ((select private.current_role()) in ('staff','admin'));
create policy pickup_lines_read on public.pickup_lines for select to authenticated using (
  (select private.current_role()) in ('staff','admin') or
  ((select private.current_role())='student' and exists(select 1 from public.food_requests r where r.id=request_id and r.student_id=(select auth.uid())))
);
create policy operations_audit_read on public.operations_audit for select to authenticated using ((select private.current_role())='admin');

create function private.audit_inventory_edit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null then
    insert into public.operations_audit(actor_id,action,record_id)
      values(auth.uid(),lower(tg_op)||'_'||tg_table_name,new.id);
  end if;
  return new;
end; $$;
revoke all on function private.audit_inventory_edit() from public,anon,authenticated;
create trigger inventory_item_audit after insert or update on public.inventory_items
for each row execute function private.audit_inventory_edit();
create trigger inventory_lot_metadata_audit after update of storage_location,received_date,expiry_date on public.inventory_lots
for each row execute function private.audit_inventory_edit();

create function private.require_staff() returns void language plpgsql security invoker set search_path='' as $$
begin
  if auth.uid() is null or coalesce(private.current_role(),'') not in ('staff','admin') then
    raise exception 'Staff access required' using errcode='42501';
  end if;
end; $$;

create function private.save_slot(p_id uuid,p_starts_at timestamptz,p_capacity integer,p_active boolean)
returns public.pickup_slots language plpgsql security definer set search_path='' as $$
declare result public.pickup_slots;
begin
  perform private.require_staff();
  perform pg_catalog.pg_advisory_xact_lock(5318,10);
  if p_starts_at is null or p_starts_at<=now() or p_active is null then raise exception 'Choose a future pickup time' using errcode='22023'; end if;
  if p_capacity is null or p_capacity < (select count(*) from public.food_requests where slot_id=p_id and status in ('submitted','approved')) then
    raise exception 'Capacity cannot be less than current reservations' using errcode='23514';
  end if;
  insert into public.pickup_slots(id,starts_at,capacity,active) values(coalesce(p_id,gen_random_uuid()),p_starts_at,p_capacity,p_active)
    on conflict(id) do update set starts_at=excluded.starts_at,capacity=excluded.capacity,active=excluded.active returning * into result;
  insert into public.operations_audit(actor_id,action,record_id) values(auth.uid(),'save_slot',result.id);
  return result;
end; $$;
create function public.save_pickup_slot(p_id uuid,p_starts_at timestamptz,p_capacity integer,p_active boolean default true)
returns public.pickup_slots language sql security invoker set search_path='' as $$ select private.save_slot(p_id,p_starts_at,p_capacity,p_active); $$;

create function private.list_slots() returns table(id uuid,starts_at timestamptz,capacity integer,active boolean,booked bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_role() is null then raise exception 'Active account required' using errcode='42501'; end if;
  return query select s.id,s.starts_at,s.capacity,s.active,count(r.id) from public.pickup_slots s
    left join public.food_requests r on r.slot_id=s.id and r.status in ('submitted','approved')
    group by s.id order by s.starts_at;
end; $$;
create function public.list_pickup_slots() returns table(id uuid,starts_at timestamptz,capacity integer,active boolean,booked bigint)
language sql stable security invoker set search_path='' as $$ select * from private.list_slots(); $$;

create function private.submit_food_request(p_id uuid,p_categories text[],p_slot_id uuid,p_note text)
returns public.food_requests language plpgsql security definer set search_path='' as $$
declare result public.food_requests; slot public.pickup_slots;
begin
  if private.current_role() is distinct from 'student' then raise exception 'Student access required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(5318,10);
  select * into result from public.food_requests where id=p_id;
  if found then
    if result.student_id<>auth.uid() then raise exception 'Request identifier unavailable' using errcode='42501'; end if;
    return result;
  end if;
  if exists(select 1 from public.food_requests where student_id=auth.uid() and status in ('submitted','approved')) then
    raise exception 'You already have an open request' using errcode='23514';
  end if;
  if p_categories is null or not private.valid_categories(p_categories) then raise exception 'Choose 1 to 10 categories' using errcode='22023'; end if;
  if exists(select 1 from unnest(p_categories) c where not exists(select 1 from private.available_inventory() a where a.category=c)) then
    raise exception 'A selected category is no longer available' using errcode='23514';
  end if;
  select * into slot from public.pickup_slots where id=p_slot_id for update;
  if not found or not slot.active or slot.starts_at<=now() then raise exception 'Choose an active future pickup slot' using errcode='23514'; end if;
  if (select count(*) from public.food_requests where slot_id=slot.id and status in ('submitted','approved'))>=slot.capacity then
    raise exception 'This pickup slot is full' using errcode='23514';
  end if;
  insert into public.food_requests(id,student_id,requested_categories,pickup_note,slot_id)
    values(p_id,auth.uid(),p_categories,p_note,p_slot_id) returning * into result;
  insert into public.operations_audit(actor_id,action,record_id) values(auth.uid(),'submit_request',result.id);
  return result;
end; $$;
create function public.submit_food_request(p_id uuid,p_categories text[],p_slot_id uuid,p_note text default '')
returns public.food_requests language sql security invoker set search_path='' as $$ select private.submit_food_request(p_id,p_categories,p_slot_id,p_note); $$;
-- All new requests must pass the server's capacity and duplicate checks.
revoke insert on public.food_requests from authenticated;
revoke insert(requested_categories,pickup_note) on public.food_requests from authenticated;

create function private.transition_request(p_id uuid,p_status text,p_note text)
returns public.food_requests language plpgsql security definer set search_path='' as $$
declare result public.food_requests; role_name text:=private.current_role();
begin
  if role_name is null then raise exception 'Active account required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(5318,10);
  select * into result from public.food_requests where id=p_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if role_name='student' and (result.student_id<>auth.uid() or p_status is distinct from 'cancelled') then
    raise exception 'You can only cancel your own request' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('approved','declined','cancelled') then raise exception 'Invalid decision' using errcode='22023'; end if;
  if result.status=p_status then return result; end if;
  if result.status not in ('submitted','approved') or (result.status='approved' and p_status='approved') then
    raise exception 'This request is no longer open' using errcode='23514';
  end if;
  if p_status='declined' and (p_note is null or length(btrim(p_note))=0) then raise exception 'Enter a decline reason' using errcode='22023'; end if;
  update public.food_requests set status=p_status,decision_note=p_note where id=p_id returning * into result;
  insert into public.operations_audit(actor_id,action,record_id) values(auth.uid(),p_status,result.id);
  return result;
end; $$;
create function public.transition_food_request(p_id uuid,p_status text,p_note text default '')
returns public.food_requests language sql security invoker set search_path='' as $$ select private.transition_request(p_id,p_status,p_note); $$;

create function private.receive_donation(p_id uuid,p_donor text,p_received date,p_lines jsonb)
returns public.donations language plpgsql security definer set search_path='' as $$
declare result public.donations; line jsonb; lot public.inventory_lots;
begin
  perform private.require_staff();
  perform pg_catalog.pg_advisory_xact_lock(5318,10);
  select * into result from public.donations where id=p_id;
  if found then return result; end if;
  if p_received>current_date or p_received is null then raise exception 'Received date cannot be in the future' using errcode='22023'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Add 1 to 100 donation items' using errcode='22023'; end if;
  insert into public.donations(id,donor,received_date,actor_id) values(p_id,p_donor,p_received,auth.uid()) returning * into result;
  for line in select value from jsonb_array_elements(p_lines) loop
    if (line->>'quantity')::integer is null or (line->>'quantity')::integer<1 then raise exception 'Positive whole quantities required' using errcode='22023'; end if;
    lot:=private.create_lot((line->>'item_id')::uuid,(line->>'quantity')::integer,line->>'storage_location',p_received,nullif(line->>'expiry_date','')::date);
    insert into public.donation_lines(donation_id,lot_id,quantity) values(result.id,lot.id,(line->>'quantity')::integer);
  end loop;
  insert into public.operations_audit(actor_id,action,record_id) values(auth.uid(),'receive_donation',result.id);
  return result;
end; $$;
create function public.receive_donation(p_id uuid,p_donor text,p_received date,p_lines jsonb)
returns public.donations language sql security invoker set search_path='' as $$ select private.receive_donation(p_id,p_donor,p_received,p_lines); $$;

create function private.complete_pickup(p_request_id uuid,p_lines jsonb,p_id_checked boolean)
returns public.food_requests language plpgsql security definer set search_path='' as $$
declare result public.food_requests; line record; lot public.inventory_lots; remaining integer; taken integer;
begin
  perform private.require_staff();
  perform pg_catalog.pg_advisory_xact_lock(5318,10);
  select * into result from public.food_requests where id=p_request_id for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  if result.status='completed' then return result; end if;
  if result.status<>'approved' then raise exception 'Approve the request before pickup' using errcode='23514'; end if;
  if p_id_checked is distinct from true or not exists(select 1 from public.profiles where id=result.student_id and student_id is not null) then
    raise exception 'Verify and save the physical student ID before pickup' using errcode='23514';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Add 1 to 100 pickup items' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) x where (x->>'quantity')::integer is null or (x->>'quantity')::integer<1 or x->>'item_id' is null) then
    raise exception 'Positive whole quantities and item IDs required' using errcode='22023';
  end if;
  -- Deterministic item/lot order avoids deadlocks; row locks also serialize manual adjustments.
  for line in select (x->>'item_id')::uuid item_id,sum((x->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(p_lines) x group by (x->>'item_id')::uuid order by (x->>'item_id')::uuid loop
    remaining:=line.quantity;
    if not exists(select 1 from public.inventory_items where id=line.item_id and active) then raise exception 'Active item required' using errcode='23514'; end if;
    for lot in select * from public.inventory_lots where item_id=line.item_id and qty_on_hand>0 and received_date<=current_date
      and (expiry_date is null or expiry_date>=current_date) order by expiry_date nulls last,id for update loop
      taken:=least(remaining,lot.qty_on_hand);
      perform private.adjust_stock(lot.id,-taken,'Pickup '||result.id::text);
      insert into public.pickup_lines(request_id,lot_id,quantity) values(result.id,lot.id,taken);
      remaining:=remaining-taken;
      exit when remaining=0;
    end loop;
    if remaining>0 then raise exception 'Insufficient eligible stock; nothing was deducted' using errcode='23514'; end if;
  end loop;
  update public.food_requests set status='completed',completed_at=now() where id=result.id returning * into result;
  insert into public.operations_audit(actor_id,action,record_id) values(auth.uid(),'complete_pickup',result.id);
  return result;
end; $$;
create function public.complete_pickup(p_request_id uuid,p_lines jsonb,p_id_checked boolean)
returns public.food_requests language sql security invoker set search_path='' as $$ select private.complete_pickup(p_request_id,p_lines,p_id_checked); $$;

create function private.walk_in(p_id uuid,p_student uuid,p_categories text[])
returns public.food_requests language plpgsql security definer set search_path='' as $$
declare result public.food_requests;
begin
  perform private.require_staff();
  perform pg_catalog.pg_advisory_xact_lock(5318,10);
  select * into result from public.food_requests where id=p_id;
  if found then return result; end if;
  if not exists(select 1 from private.user_access where user_id=p_student and role='student' and enabled) then
    raise exception 'Choose an active registered student' using errcode='23514';
  end if;
  if exists(select 1 from public.food_requests where student_id=p_student and status in ('submitted','approved')) then
    raise exception 'This student already has an open request' using errcode='23514';
  end if;
  if p_categories is null or not private.valid_categories(p_categories) then raise exception 'Choose 1 to 10 categories' using errcode='22023'; end if;
  insert into public.food_requests(id,student_id,requested_categories,status,pickup_note)
    values(p_id,p_student,p_categories,'approved','Walk-in') returning * into result;
  insert into public.operations_audit(actor_id,action,record_id) values(auth.uid(),'walk_in',result.id);
  return result;
end; $$;
create function public.create_walk_in(p_id uuid,p_student uuid,p_categories text[])
returns public.food_requests language sql security invoker set search_path='' as $$ select private.walk_in(p_id,p_student,p_categories); $$;

create function private.student_directory() returns setof public.profiles
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_staff();
  return query select p.* from public.profiles p join private.user_access a on a.user_id=p.id where a.role='student' and a.enabled order by p.id;
end; $$;
create function public.student_directory() returns setof public.profiles
language sql stable security invoker set search_path='' as $$ select * from private.student_directory(); $$;
revoke all on function private.walk_in(uuid,uuid,text[]),public.create_walk_in(uuid,uuid,text[]),private.student_directory(),public.student_directory() from public,anon;
grant execute on function private.walk_in(uuid,uuid,text[]),public.create_walk_in(uuid,uuid,text[]),private.student_directory(),public.student_directory() to authenticated;

-- No definer function is anonymously callable. Public wrappers remain invokers.
revoke all on function private.require_staff(),private.save_slot(uuid,timestamptz,integer,boolean),public.save_pickup_slot(uuid,timestamptz,integer,boolean),
  private.list_slots(),public.list_pickup_slots(),private.submit_food_request(uuid,text[],uuid,text),public.submit_food_request(uuid,text[],uuid,text),
  private.transition_request(uuid,text,text),public.transition_food_request(uuid,text,text),private.receive_donation(uuid,text,date,jsonb),public.receive_donation(uuid,text,date,jsonb),
  private.complete_pickup(uuid,jsonb,boolean),public.complete_pickup(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function private.require_staff(),private.save_slot(uuid,timestamptz,integer,boolean),public.save_pickup_slot(uuid,timestamptz,integer,boolean),
  private.list_slots(),public.list_pickup_slots(),private.submit_food_request(uuid,text[],uuid,text),public.submit_food_request(uuid,text[],uuid,text),
  private.transition_request(uuid,text,text),public.transition_food_request(uuid,text,text),private.receive_donation(uuid,text,date,jsonb),public.receive_donation(uuid,text,date,jsonb),
  private.complete_pickup(uuid,jsonb,boolean),public.complete_pickup(uuid,jsonb,boolean) to authenticated;
commit;
