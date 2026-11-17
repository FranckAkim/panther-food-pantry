-- Functions for pantry operations. Same pattern as the earlier migrations:
-- private.* security definer functions check the caller's role and do the work;
-- public.* security invoker wrappers are the API exposed through PostgREST.
-- Dates follow the pantry's local time (America/Chicago).

-- Helpers --------------------------------------------------------------------

create function private.pantry_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

create function private.require_role(p_roles text[], p_message text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.current_role() is null or not (private.current_role() = any(p_roles)) then
    raise exception '%', p_message using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function private.log_action(p_action text, p_entity text, p_entity_id text,
  p_record text, p_change text, p_details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log(actor_id, action, entity, entity_id, record, change, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, left(coalesce(p_record, ''), 300),
    left(coalesce(p_change, ''), 500), coalesce(p_details, '{}'::jsonb));
$$;

-- Registration stores the student ID the student typed, unverified.
create or replace function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare claimed text := upper(btrim(coalesce(new.raw_user_meta_data->>'student_id', '')));
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'pvamu.edu' then
    raise exception 'A pvamu.edu email is required' using errcode = '23514';
  end if;
  insert into public.profiles(id, display_name, claimed_student_id)
    values(new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 100),
      case when char_length(claimed) between 1 and 30 then claimed end);
  insert into private.user_access(user_id) values(new.id);
  return new;
end;
$$;

-- Lots created through the existing function are recorded as opening stock.
create or replace function private.create_lot(p_item_id uuid, p_quantity integer, p_storage_location text,
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
  insert into public.inventory_lots(item_id,qty_on_hand,storage_location,received_date,expiry_date,received_quantity)
    values(p_item_id,p_quantity,p_storage_location,p_received_date,p_expiry_date,p_quantity) returning * into created;
  insert into public.stock_adjustments(lot_id,quantity_change,quantity_after,reason,actor_id,kind)
    values(created.id,p_quantity,p_quantity,'Initial stock',auth.uid(),'initial');
  return created;
end;
$$;

-- Accounts and students -------------------------------------------------------

create function private.list_accounts()
returns table(user_id uuid, display_name text, email text, student_id text, claimed_student_id text,
  role text, enabled boolean, last_sign_in_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role(array['admin'], 'Administrator access required');
  return query select p.id, p.display_name, u.email::text, p.student_id, p.claimed_student_id,
      a.role, a.enabled, u.last_sign_in_at, p.created_at
    from public.profiles p
    join private.user_access a on a.user_id = p.id
    join auth.users u on u.id = p.id
    order by p.created_at;
end;
$$;

create function private.list_students()
returns table(kind text, id uuid, full_name text, student_id text, id_verified boolean,
  id_checked_at timestamptz, enabled boolean, last_pickup_at timestamptz,
  latest_request_status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  return query
    select 'account'::text, p.id, p.display_name, coalesce(p.student_id, p.claimed_student_id),
      p.student_id is not null,
      (select max(s.created_at) from public.student_id_audit s where s.target_id = p.id),
      a.enabled,
      (select max(d.distributed_at) from public.distributions d where d.profile_id = p.id),
      (select r.status from public.food_requests r where r.student_id = p.id
        order by r.created_at desc limit 1),
      p.created_at
    from public.profiles p join private.user_access a on a.user_id = p.id
    where a.role = 'student'
    union all
    select 'provisional'::text, ps.id, ps.full_name, ps.student_id, ps.id_checked_at is not null,
      ps.id_checked_at, true,
      (select max(d.distributed_at) from public.distributions d where d.provisional_student_id = ps.id),
      null::text, ps.created_at
    from public.provisional_students ps
    where ps.linked_profile_id is null
    order by 3;
end;
$$;

-- Walk-in search: verified account ID, then an unverified (claimed) ID, then provisional.
create function private.find_student(p_student_id text)
returns table(kind text, id uuid, full_name text, student_id text, id_verified boolean, has_pickups boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_id text := upper(btrim(coalesce(p_student_id, '')));
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  if char_length(v_id) not between 1 and 30 then
    raise exception 'Enter a student ID.' using errcode = '22023';
  end if;
  return query
    with candidates as (
      select 1 as rank, 'account'::text as kind, p.id, p.display_name as full_name,
        coalesce(p.student_id, p.claimed_student_id) as student_id,
        p.student_id is not null as id_verified, p.created_at
      from public.profiles p join private.user_access a on a.user_id = p.id
      where a.enabled and (p.student_id = v_id or (p.student_id is null and p.claimed_student_id = v_id))
      union all
      select 2, 'provisional'::text, ps.id, ps.full_name, ps.student_id,
        ps.id_checked_at is not null, ps.created_at
      from public.provisional_students ps
      where ps.student_id = v_id and ps.linked_profile_id is null
    )
    select c.kind, c.id, c.full_name, c.student_id, c.id_verified,
      exists(select 1 from public.distributions d
        where (c.kind = 'account' and d.profile_id = c.id)
           or (c.kind = 'provisional' and d.provisional_student_id = c.id))
    from candidates c
    order by c.rank, c.id_verified desc, c.created_at
    limit 1;
end;
$$;

create function private.create_provisional_student(p_student_id text, p_full_name text, p_id_checked boolean)
returns public.provisional_students
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_id text := upper(btrim(coalesce(p_student_id, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  created public.provisional_students;
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');
  if char_length(v_id) not between 1 and 30 then
    raise exception 'Enter the student ID number.' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'Enter the student''s full name.' using errcode = '22023';
  end if;
  if exists(select 1 from public.profiles p where p.student_id = v_id or p.claimed_student_id = v_id) then
    raise exception 'An account already uses this student ID. Search for the student instead.'
      using errcode = '23505';
  end if;
  begin
    insert into public.provisional_students(student_id, full_name, id_checked_at, id_checked_by, created_by)
      values (v_id, v_name, case when p_id_checked then now() end,
        case when p_id_checked then v_actor end, v_actor)
      returning * into created;
  exception when unique_violation then
    raise exception 'A profile with this student ID already exists. Search for their existing profile.'
      using errcode = '23505';
  end;
  perform private.log_action('Provisional profile created', 'provisional_student', created.id::text,
    'Student · ' || v_name, case when p_id_checked then 'ID card checked' else 'Profile created' end);
  return created;
end;
$$;

create function private.check_provisional_id(p_provisional_student_id uuid)
returns public.provisional_students
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; updated public.provisional_students;
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');
  select * into updated from public.provisional_students where id = p_provisional_student_id for update;
  if not found then raise exception 'Student profile not found.' using errcode = 'P0002'; end if;
  if updated.id_checked_at is not null then return updated; end if;
  update public.provisional_students set id_checked_at = now(), id_checked_by = v_actor
    where id = p_provisional_student_id returning * into updated;
  perform private.log_action('Student ID checked', 'provisional_student', updated.id::text,
    'Student · ' || updated.full_name, 'ID card checked');
  return updated;
end;
$$;

-- When an account's student ID is verified, link the walk-in profile with that ID.
create function private.link_provisional_student() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_provisional uuid;
begin
  if new.student_id is null or new.student_id is not distinct from old.student_id
    or exists(select 1 from public.provisional_students where linked_profile_id = new.id) then
    return new;
  end if;
  update public.provisional_students set linked_profile_id = new.id
    where student_id = new.student_id and linked_profile_id is null
    returning id into v_provisional;
  if v_provisional is not null then
    update public.distributions set profile_id = new.id
      where provisional_student_id = v_provisional and profile_id is null;
    perform private.log_action('Provisional profile linked', 'profile', new.id::text,
      'Student · ' || new.display_name, 'Walk-in history linked to account · ' || new.student_id);
  end if;
  return new;
end;
$$;
create trigger pantry_link_provisional_student after update of student_id on public.profiles
for each row execute function private.link_provisional_student();

-- Pickup slots ------------------------------------------------------------------

-- Reservations that hold a seat: waiting, approved, and past results.
create function private.slot_booked(p_slot_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.food_requests r
  where r.slot_id = p_slot_id and r.status in ('submitted','approved','completed','no_show');
$$;

create function private.slot_availability(p_from date, p_to date)
returns table(id uuid, starts_at timestamptz, ends_at timestamptz, capacity integer, booked integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_role() is null then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'Choose a date range of up to three months.' using errcode = '22023';
  end if;
  return query select s.id, s.starts_at, s.ends_at, s.capacity, private.slot_booked(s.id)
    from public.pickup_slots s
    where s.starts_at >= (p_from::timestamp at time zone 'America/Chicago')
      and s.starts_at < ((p_to + 1)::timestamp at time zone 'America/Chicago')
    order by s.starts_at;
end;
$$;

create function private.create_slots(p_date date, p_start time, p_end time,
  p_interval_minutes integer, p_capacity integer)
returns setof public.pickup_slots
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_at timestamp;
  v_count integer := 0;
  created public.pickup_slots;
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');
  if p_date is null or p_date < private.pantry_today() or p_date > private.pantry_today() + 366 then
    raise exception 'Choose a date from today through the next year.' using errcode = '22023';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'End time must be later than start time.' using errcode = '22023';
  end if;
  if p_interval_minutes is null or p_interval_minutes not between 5 and 240 then
    raise exception 'Choose a slot interval between 5 and 240 minutes.' using errcode = '22023';
  end if;
  if p_capacity is null or p_capacity not between 1 and 500 then
    raise exception 'Capacity must be between 1 and 500.' using errcode = '22023';
  end if;
  v_at := p_date + p_start;
  while v_at < p_date + p_end loop
    created := null;
    insert into public.pickup_slots(starts_at, ends_at, capacity, created_by)
      values (v_at at time zone 'America/Chicago',
        (v_at + make_interval(mins => p_interval_minutes)) at time zone 'America/Chicago',
        p_capacity, v_actor)
      on conflict (starts_at) do nothing
      returning * into created;
    if created.id is not null then
      v_count := v_count + 1;
      return next created;
    end if;
    v_at := v_at + make_interval(mins => p_interval_minutes);
  end loop;
  if v_count = 0 then
    raise exception 'Slots already exist at all of these times. Choose a different time range.'
      using errcode = '23505';
  end if;
  perform private.log_action('Pickup slots created', 'pickup_slot', null,
    'Slots · ' || to_char(p_date, 'Mon FMDD, YYYY'),
    v_count || case when v_count = 1 then ' slot' else ' slots' end || ' · capacity ' || p_capacity);
  return;
end;
$$;

create function private.update_slot_capacity(p_slot_id uuid, p_capacity integer)
returns public.pickup_slots
language plpgsql security definer set search_path = '' as $$
declare v_slot public.pickup_slots; v_booked integer; v_old integer;
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  if p_capacity is null or p_capacity not between 1 and 500 then
    raise exception 'Capacity must be between 1 and 500.' using errcode = '22023';
  end if;
  select * into v_slot from public.pickup_slots where id = p_slot_id for update;
  if not found then raise exception 'Pickup slot not found.' using errcode = 'P0002'; end if;
  v_booked := private.slot_booked(p_slot_id);
  if p_capacity < v_booked then
    raise exception '% already booked this slot. Capacity must be at least %.',
      v_booked || case when v_booked = 1 then ' student' else ' students' end, v_booked
      using errcode = '23514';
  end if;
  if p_capacity = v_slot.capacity then return v_slot; end if;
  v_old := v_slot.capacity;
  update public.pickup_slots set capacity = p_capacity where id = p_slot_id returning * into v_slot;
  perform private.log_action('Pickup slot updated', 'pickup_slot', p_slot_id::text,
    'Slot · ' || to_char(v_slot.starts_at at time zone 'America/Chicago', 'Mon FMDD, YYYY FMHH12:MI AM'),
    'Capacity: ' || v_old || ' → ' || p_capacity);
  return v_slot;
end;
$$;

-- Requests ------------------------------------------------------------------------

create function private.submit_request(p_slot_id uuid, p_item_id uuid, p_note text)
returns public.food_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_slot public.pickup_slots;
  v_category text;
  v_note text := btrim(coalesce(p_note, ''));
  created public.food_requests;
begin
  v_actor := private.require_role(array['student'], 'Only student accounts can request food.');
  if exists(select 1 from public.food_requests r
    where r.student_id = v_actor and r.status in ('submitted','approved')) then
    raise exception 'You already have an open request. Cancel it before choosing a new pickup.'
      using errcode = '23505';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Keep the dietary note under 500 characters.' using errcode = '22023';
  end if;
  -- Lock the slot so concurrent requests cannot overbook it.
  select * into v_slot from public.pickup_slots where id = p_slot_id for update;
  if not found then
    raise exception 'This pickup time is no longer available. Choose another time.' using errcode = 'P0002';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'This pickup time has passed. Choose another time.' using errcode = '22023';
  end if;
  if private.slot_booked(p_slot_id) >= v_slot.capacity then
    raise exception 'This pickup time is full. Choose another time.' using errcode = '23514';
  end if;
  select i.category into v_category from public.inventory_items i
  where i.id = p_item_id and i.active and exists(
    select 1 from public.inventory_lots l where l.item_id = i.id and l.qty_on_hand > 0
      and l.received_date <= private.pantry_today()
      and (l.expiry_date is null or l.expiry_date >= private.pantry_today()));
  if v_category is null then
    raise exception 'This food item is no longer available. Choose another item.' using errcode = '22023';
  end if;
  begin
    insert into public.food_requests(student_id, requested_categories, pickup_note, slot_id, requested_item_id)
      values (v_actor, array[v_category], v_note, p_slot_id, p_item_id)
      returning * into created;
  exception when unique_violation then
    raise exception 'You already have an open request. Cancel it before choosing a new pickup.'
      using errcode = '23505';
  end;
  return created;
end;
$$;

create function private.cancel_request(p_request_id uuid) returns public.food_requests
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; updated public.food_requests;
begin
  v_actor := private.require_role(array['student'], 'Only student accounts can cancel requests.');
  update public.food_requests set status = 'cancelled', updated_at = now()
    where id = p_request_id and student_id = v_actor and status in ('submitted','approved')
    returning * into updated;
  if not found then
    raise exception 'This request can no longer be cancelled.' using errcode = '22023';
  end if;
  return updated;
end;
$$;

create function private.status_label(p_status text) returns text
language sql immutable set search_path = '' as $$
  select case p_status when 'submitted' then 'Submitted' when 'approved' then 'Approved'
    when 'declined' then 'Declined' when 'completed' then 'Completed'
    when 'cancelled' then 'Cancelled' when 'no_show' then 'No-show' else p_status end;
$$;

create function private.decide_request(p_request_id uuid, p_approve boolean, p_reason text)
returns public.food_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_request public.food_requests;
  v_name text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');
  if p_approve is null then raise exception 'Choose approve or decline.' using errcode = '22023'; end if;
  select * into v_request from public.food_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  if v_request.status <> 'submitted' then
    raise exception 'This request is already %.', lower(private.status_label(v_request.status))
      using errcode = '22023';
  end if;
  if not p_approve and v_reason is null then
    raise exception 'Enter a reason so the student knows why the request was declined.' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Keep the reason under 500 characters.' using errcode = '22023';
  end if;
  update public.food_requests set
      status = case when p_approve then 'approved' else 'declined' end,
      decline_reason = case when p_approve then null else v_reason end,
      decided_by = v_actor, decided_at = now(), updated_at = now()
    where id = p_request_id returning * into v_request;
  select p.display_name into v_name from public.profiles p where p.id = v_request.student_id;
  perform private.log_action(case when p_approve then 'Request approved' else 'Request declined' end,
    'food_request', p_request_id::text, 'Request · ' || coalesce(nullif(v_name, ''), 'Student'),
    'Submitted → ' || private.status_label(v_request.status));
  return v_request;
end;
$$;

create function private.mark_no_show(p_request_id uuid) returns public.food_requests
language plpgsql security definer set search_path = '' as $$
declare v_request public.food_requests; v_ends timestamptz; v_name text;
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  select * into v_request from public.food_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  if v_request.status <> 'approved' then
    raise exception 'Only approved pickups can be marked as a no-show.' using errcode = '22023';
  end if;
  select s.ends_at into v_ends from public.pickup_slots s where s.id = v_request.slot_id;
  if now() < v_ends + interval '30 minutes' then
    raise exception 'You can mark a no-show 30 minutes after the pickup slot ends.' using errcode = '22023';
  end if;
  update public.food_requests set status = 'no_show', updated_at = now()
    where id = p_request_id returning * into v_request;
  select p.display_name into v_name from public.profiles p where p.id = v_request.student_id;
  perform private.log_action('Pickup marked no-show', 'food_request', p_request_id::text,
    'Request · ' || coalesce(nullif(v_name, ''), 'Student'), 'Approved → No-show');
  return v_request;
end;
$$;

-- Items handed out for one distribution, as [{item_id, name, unit, quantity}].
create function private.distribution_items(p_distribution_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('item_id', i.id, 'name', i.name, 'unit', i.unit,
      'quantity', t.quantity) order by i.name), '[]'::jsonb)
  from (select l.item_id, sum(l.quantity)::integer as quantity from public.distribution_lines l
        where l.distribution_id = p_distribution_id group by l.item_id) t
  join public.inventory_items i on i.id = t.item_id;
$$;

create function private.my_requests()
returns table(id uuid, status text, created_at timestamptz, slot_id uuid, slot_starts_at timestamptz,
  slot_ends_at timestamptz, item_id uuid, item_name text, categories text[], pickup_note text,
  decline_reason text, completed_at timestamptz, items jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_role() is null then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  return query select r.id, r.status, r.created_at, s.id, s.starts_at, s.ends_at, i.id, i.name,
      r.requested_categories, r.pickup_note, r.decline_reason, d.distributed_at,
      case when d.id is null then '[]'::jsonb else private.distribution_items(d.id) end
    from public.food_requests r
    left join public.pickup_slots s on s.id = r.slot_id
    left join public.inventory_items i on i.id = r.requested_item_id
    left join public.distributions d on d.request_id = r.id
    where r.student_id = auth.uid()
    order by r.created_at desc;
end;
$$;

create function private.list_requests(p_since timestamptz)
returns table(id uuid, status text, created_at timestamptz, profile_id uuid, student_name text,
  student_id text, id_verified boolean, first_visit boolean, slot_id uuid, slot_starts_at timestamptz,
  slot_ends_at timestamptz, item_id uuid, item_name text, categories text[], pickup_note text,
  decline_reason text, decided_by_name text, decided_at timestamptz, items jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  return query select r.id, r.status, r.created_at, p.id, p.display_name,
      coalesce(p.student_id, p.claimed_student_id), p.student_id is not null,
      not exists(select 1 from public.distributions x where x.profile_id = p.id
        and x.request_id is distinct from r.id),
      s.id, s.starts_at, s.ends_at, i.id, i.name, r.requested_categories, r.pickup_note,
      r.decline_reason, dp.display_name, r.decided_at,
      case when d.id is null then '[]'::jsonb else private.distribution_items(d.id) end
    from public.food_requests r
    join public.profiles p on p.id = r.student_id
    left join public.pickup_slots s on s.id = r.slot_id
    left join public.inventory_items i on i.id = r.requested_item_id
    left join public.profiles dp on dp.id = r.decided_by
    left join public.distributions d on d.request_id = r.id
    where r.status in ('submitted','approved')
       or r.created_at >= coalesce(p_since, now() - interval '60 days')
    order by r.created_at desc;
end;
$$;

-- One day's pickups: approved/completed/no-show requests in that day's slots, plus walk-ins.
create function private.pickups_for_day(p_date date)
returns table(request_id uuid, distribution_id uuid, kind text, recipient_id uuid, student_name text,
  student_id text, id_verified boolean, first_visit boolean, status text, slot_id uuid,
  slot_starts_at timestamptz, slot_ends_at timestamptz, slot_capacity integer, slot_booked integer,
  pickup_note text, item_name text, distributed_at timestamptz, items jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := p_date::timestamp at time zone 'America/Chicago';
  v_end timestamptz := (p_date + 1)::timestamp at time zone 'America/Chicago';
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  if p_date is null then raise exception 'Choose a date.' using errcode = '22023'; end if;
  return query
    select r.id, d.id, 'account'::text, p.id, p.display_name,
      coalesce(p.student_id, p.claimed_student_id), p.student_id is not null,
      not exists(select 1 from public.distributions x where x.profile_id = p.id
        and x.id is distinct from d.id),
      r.status, s.id, s.starts_at, s.ends_at, s.capacity, private.slot_booked(s.id),
      r.pickup_note, i.name, d.distributed_at,
      case when d.id is null then '[]'::jsonb else private.distribution_items(d.id) end
    from public.food_requests r
    join public.pickup_slots s on s.id = r.slot_id
    join public.profiles p on p.id = r.student_id
    left join public.inventory_items i on i.id = r.requested_item_id
    left join public.distributions d on d.request_id = r.id
    where r.status in ('approved','completed','no_show')
      and s.starts_at >= v_start and s.starts_at < v_end
    union all
    select null::uuid, d.id,
      case when d.profile_id is not null then 'account' else 'provisional' end,
      coalesce(d.profile_id, d.provisional_student_id),
      coalesce(p.display_name, ps.full_name),
      coalesce(p.student_id, p.claimed_student_id, ps.student_id),
      case when p.id is not null then p.student_id is not null else ps.id_checked_at is not null end,
      not exists(select 1 from public.distributions x where x.id <> d.id and x.distributed_at < d.distributed_at
        and ((d.profile_id is not null and x.profile_id = d.profile_id)
          or (d.profile_id is null and x.provisional_student_id = d.provisional_student_id))),
      'completed'::text, null::uuid, null::timestamptz, null::timestamptz, null::integer, null::integer,
      ''::text, null::text, d.distributed_at, private.distribution_items(d.id)
    from public.distributions d
    left join public.profiles p on p.id = d.profile_id
    left join public.provisional_students ps on ps.id = d.provisional_student_id
    where d.request_id is null and d.distributed_at >= v_start and d.distributed_at < v_end
    order by 11 nulls last, 5;
end;
$$;

-- Inventory ---------------------------------------------------------------------

create function private.create_item(p_name text, p_category text, p_unit text, p_low_stock_threshold integer,
  p_quantity integer, p_storage_location text, p_expiry_date date)
returns public.inventory_items
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_unit text := btrim(coalesce(p_unit, ''));
  v_location text := btrim(coalesce(p_storage_location, ''));
  v_quantity integer := coalesce(p_quantity, 0);
  created public.inventory_items;
  v_lot public.inventory_lots;
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Enter an item name (up to 120 characters).' using errcode = '22023';
  end if;
  if char_length(v_category) not between 1 and 80 then
    raise exception 'Choose a category.' using errcode = '22023';
  end if;
  if char_length(v_unit) not between 1 and 30 then
    raise exception 'Enter how this item is counted, for example cans.' using errcode = '22023';
  end if;
  if p_low_stock_threshold is null or p_low_stock_threshold not between 0 and 100000 then
    raise exception 'Enter a low-stock alert of 0 or more.' using errcode = '22023';
  end if;
  if v_quantity not between 0 and 1000000 then
    raise exception 'Enter an opening quantity of 0 or more.' using errcode = '22023';
  end if;
  if v_quantity > 0 and char_length(v_location) not between 1 and 100 then
    raise exception 'Enter the shelf or bin for the opening stock.' using errcode = '22023';
  end if;
  if v_quantity > 0 and p_expiry_date is not null and p_expiry_date < private.pantry_today() then
    raise exception 'The expiry date cannot be in the past.' using errcode = '22023';
  end if;
  if exists(select 1 from public.inventory_items i where i.active and lower(btrim(i.name)) = lower(v_name)) then
    raise exception 'An item with this name already exists.' using errcode = '23505';
  end if;
  insert into public.inventory_items(name, category, unit, low_stock_threshold)
    values (v_name, v_category, v_unit, p_low_stock_threshold) returning * into created;
  if v_quantity > 0 then
    insert into public.inventory_lots(item_id, qty_on_hand, storage_location, received_date, expiry_date, received_quantity)
      values (created.id, v_quantity, v_location, private.pantry_today(), p_expiry_date, v_quantity)
      returning * into v_lot;
    insert into public.stock_adjustments(lot_id, quantity_change, quantity_after, reason, actor_id, kind)
      values (v_lot.id, v_quantity, v_quantity, 'Opening stock', v_actor, 'initial');
  end if;
  perform private.log_action('Inventory item added', 'inventory_item', created.id::text,
    'Inventory · ' || v_name, v_quantity || ' ' || v_unit);
  return created;
end;
$$;

create function private.update_item(p_item_id uuid, p_name text, p_category text, p_unit text,
  p_low_stock_threshold integer)
returns public.inventory_items
language plpgsql security definer set search_path = '' as $$
declare
  v_before public.inventory_items;
  v_after public.inventory_items;
  v_name text := btrim(coalesce(p_name, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_unit text := btrim(coalesce(p_unit, ''));
  v_changes text[] := '{}';
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  if char_length(v_name) not between 1 and 120 then
    raise exception 'Enter an item name (up to 120 characters).' using errcode = '22023';
  end if;
  if char_length(v_category) not between 1 and 80 then
    raise exception 'Choose a category.' using errcode = '22023';
  end if;
  if char_length(v_unit) not between 1 and 30 then
    raise exception 'Enter how this item is counted, for example cans.' using errcode = '22023';
  end if;
  if p_low_stock_threshold is null or p_low_stock_threshold not between 0 and 100000 then
    raise exception 'Enter a low-stock alert of 0 or more.' using errcode = '22023';
  end if;
  select * into v_before from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Item not found.' using errcode = 'P0002'; end if;
  if exists(select 1 from public.inventory_items i where i.active and i.id <> p_item_id
    and lower(btrim(i.name)) = lower(v_name)) then
    raise exception 'An item with this name already exists.' using errcode = '23505';
  end if;
  update public.inventory_items set name = v_name, category = v_category, unit = v_unit,
      low_stock_threshold = p_low_stock_threshold
    where id = p_item_id returning * into v_after;
  if v_before.name <> v_after.name then
    v_changes := v_changes || ('name: ' || v_before.name || ' → ' || v_after.name); end if;
  if v_before.category <> v_after.category then
    v_changes := v_changes || ('category: ' || v_before.category || ' → ' || v_after.category); end if;
  if v_before.unit <> v_after.unit then
    v_changes := v_changes || ('unit: ' || v_before.unit || ' → ' || v_after.unit); end if;
  if v_before.low_stock_threshold <> v_after.low_stock_threshold then
    v_changes := v_changes || ('alert: ' || v_before.low_stock_threshold || ' → ' || v_after.low_stock_threshold); end if;
  if cardinality(v_changes) > 0 then
    perform private.log_action('Inventory item updated', 'inventory_item', p_item_id::text,
      'Inventory · ' || v_after.name, array_to_string(v_changes, '; '));
  end if;
  return v_after;
end;
$$;

-- Set a lot to a counted quantity; recorded through the existing adjust_stock ledger.
create function private.set_lot_quantity(p_lot_id uuid, p_quantity integer, p_reason text)
returns public.inventory_lots
language plpgsql security definer set search_path = '' as $$
declare v_current integer; v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  if p_quantity is null or p_quantity < 0 then
    raise exception 'Enter a quantity of 0 or more.' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 1 and 500 then
    raise exception 'Enter a reason for this adjustment.' using errcode = '22023';
  end if;
  select qty_on_hand into v_current from public.inventory_lots where id = p_lot_id for update;
  if not found then raise exception 'Lot not found.' using errcode = 'P0002'; end if;
  if p_quantity = v_current then
    raise exception 'Enter a quantity different from the current amount.' using errcode = '22023';
  end if;
  return private.adjust_stock(p_lot_id, p_quantity - v_current, v_reason);
end;
$$;

-- Donations -------------------------------------------------------------------------

-- p_lines: [{item_id, quantity, expiry_date (YYYY-MM-DD or null), storage_location}]
create function private.record_donation(p_received_on date, p_donors text[], p_lines jsonb)
returns public.donations
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_names text[];
  v_donation public.donations;
  v_line jsonb;
  v_index integer;
  v_item_id uuid;
  v_quantity integer;
  v_expiry date;
  v_location text;
  v_lot public.inventory_lots;
  v_units integer := 0;
  v_count integer := 0;
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');
  if p_received_on is null or p_received_on > private.pantry_today() then
    raise exception 'Choose the date this donation was received (today or earlier).' using errcode = '22023';
  end if;
  v_names := array(select btrim(n) from unnest(coalesce(p_donors, '{}'::text[])) n
    where btrim(coalesce(n, '')) <> '');
  if cardinality(v_names) = 0 or cardinality(v_names) <> cardinality(coalesce(p_donors, '{}'::text[])) then
    raise exception 'Choose a donor or enter a name for each donor.' using errcode = '22023';
  end if;
  if cardinality(v_names) > 10 or exists(select 1 from unnest(v_names) n where char_length(n) > 120) then
    raise exception 'Enter up to 10 donors with names under 120 characters.' using errcode = '22023';
  end if;
  if (select count(distinct lower(n)) from unnest(v_names) n) <> cardinality(v_names) then
    raise exception 'Each donor should only be added once.' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one item to this donation.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 100 then
    raise exception 'Record up to 100 items per donation.' using errcode = '22023';
  end if;

  insert into public.donations(received_on, recorded_by) values (p_received_on, v_actor)
    returning * into v_donation;
  insert into public.donors(name) select n from unnest(v_names) n
    on conflict ((lower(btrim(name)))) do nothing;
  insert into public.donation_donors(donation_id, donor_id)
    select v_donation.id, d.id from public.donors d
    where lower(btrim(d.name)) in (select lower(n) from unnest(v_names) n);

  for v_index in 0 .. jsonb_array_length(p_lines) - 1 loop
    v_line := p_lines -> v_index;
    select i.id into v_item_id from public.inventory_items i
      where i.id::text = v_line->>'item_id' and i.active;
    if v_item_id is null then
      raise exception 'Choose an inventory item for item %.', v_index + 1 using errcode = '22023';
    end if;
    if coalesce(v_line->>'quantity', '') !~ '^[0-9]{1,6}$' or (v_line->>'quantity')::integer < 1 then
      raise exception 'Enter a whole-number quantity of at least 1 for item %.', v_index + 1 using errcode = '22023';
    end if;
    v_quantity := (v_line->>'quantity')::integer;
    v_location := btrim(coalesce(v_line->>'storage_location', ''));
    if char_length(v_location) not between 1 and 100 then
      raise exception 'Enter a shelf or bin for item %.', v_index + 1 using errcode = '22023';
    end if;
    v_expiry := null;
    if nullif(v_line->>'expiry_date', '') is not null then
      if (v_line->>'expiry_date') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Enter a valid expiry date for item %.', v_index + 1 using errcode = '22023';
      end if;
      v_expiry := (v_line->>'expiry_date')::date;
      if v_expiry < p_received_on then
        raise exception 'The expiry date for item % is before the date received.', v_index + 1
          using errcode = '22023';
      end if;
    end if;
    insert into public.inventory_lots(item_id, qty_on_hand, storage_location, received_date, expiry_date,
        donation_id, received_quantity)
      values (v_item_id, v_quantity, v_location, p_received_on, v_expiry, v_donation.id, v_quantity)
      returning * into v_lot;
    insert into public.stock_adjustments(lot_id, quantity_change, quantity_after, reason, actor_id, kind)
      values (v_lot.id, v_quantity, v_quantity, 'Donation', v_actor, 'donation');
    v_units := v_units + v_quantity;
    v_count := v_count + 1;
    v_item_id := null;
  end loop;

  perform private.log_action('Donation recorded', 'donation', v_donation.id::text,
    'Donation · ' || array_to_string(v_names, ', '),
    v_count || case when v_count = 1 then ' lot' else ' lots' end || ' added · ' || v_units || ' units');
  return v_donation;
end;
$$;

-- Distribution (handing out food) -------------------------------------------------------

-- Hand out food for an approved request (p_request_id) or a walk-in (p_profile_id or
-- p_provisional_student_id). p_items: [{item_id, quantity}]. Stock is taken from the
-- earliest-expiring usable lots first, with row locks so two pickups cannot take the same stock.
create function private.complete_distribution(p_request_id uuid, p_profile_id uuid,
  p_provisional_student_id uuid, p_items jsonb, p_id_checked boolean)
returns public.distributions
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_today date := private.pantry_today();
  v_request public.food_requests;
  v_profile public.profiles;
  v_provisional public.provisional_students;
  v_profile_id uuid;
  v_provisional_id uuid;
  v_name text;
  v_first boolean;
  v_distribution public.distributions;
  v_line record;
  v_lot record;
  v_item public.inventory_items;
  v_available integer;
  v_remaining integer;
  v_take integer;
  v_units integer := 0;
begin
  v_actor := private.require_role(array['staff','admin'], 'Staff access required');

  if p_request_id is not null then
    if p_profile_id is not null or p_provisional_student_id is not null then
      raise exception 'Choose either a request or a walk-in student.' using errcode = '22023';
    end if;
    select * into v_request from public.food_requests where id = p_request_id for update;
    if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
    if v_request.status = 'completed' then
      raise exception 'This pickup has already been completed.' using errcode = '23505';
    end if;
    if v_request.status <> 'approved' then
      raise exception 'This request is no longer active. Return to the pickup list.' using errcode = '22023';
    end if;
    v_profile_id := v_request.student_id;
  elsif p_profile_id is not null and p_provisional_student_id is null then
    v_profile_id := p_profile_id;
  elsif p_provisional_student_id is not null and p_profile_id is null then
    select * into v_provisional from public.provisional_students
      where id = p_provisional_student_id for update;
    if not found then raise exception 'Student profile not found.' using errcode = 'P0002'; end if;
    if v_provisional.linked_profile_id is not null then
      v_profile_id := v_provisional.linked_profile_id;
    else
      v_provisional_id := v_provisional.id;
    end if;
  else
    raise exception 'Choose the student receiving this pickup.' using errcode = '22023';
  end if;

  if v_profile_id is not null then
    select * into v_profile from public.profiles where id = v_profile_id for update;
    if not found then raise exception 'Student profile not found.' using errcode = 'P0002'; end if;
    v_name := coalesce(nullif(v_profile.display_name, ''), 'Student');
    v_first := not exists(select 1 from public.distributions d where d.profile_id = v_profile_id);
  else
    v_name := v_provisional.full_name;
    v_first := not exists(select 1 from public.distributions d where d.provisional_student_id = v_provisional_id);
  end if;
  if v_first and p_id_checked is distinct from true then
    raise exception 'Check the student ID card before completing this first pickup.' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item before completing the pickup.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Hand out up to 50 different items per pickup.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e->>'quantity', '') !~ '^[0-9]{1,5}$' or (e->>'quantity')::integer < 1
       or coalesce(e->>'item_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') then
    raise exception 'Every item needs a whole-number quantity of at least 1.' using errcode = '22023';
  end if;

  insert into public.distributions(request_id, profile_id, provisional_student_id, staff_id, id_checked)
    values (v_request.id, v_profile_id, v_provisional_id, v_actor, coalesce(p_id_checked, false))
    returning * into v_distribution;

  -- Items in a fixed order so concurrent pickups lock lots consistently.
  for v_line in
    select (e->>'item_id')::uuid as item_id, sum((e->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select * into v_item from public.inventory_items where id = v_line.item_id;
    if not found then raise exception 'One of the items no longer exists.' using errcode = 'P0002'; end if;
    perform 1 from public.inventory_lots l
      where l.item_id = v_line.item_id and l.qty_on_hand > 0 and l.received_date <= v_today
        and (l.expiry_date is null or l.expiry_date >= v_today)
      order by l.id for update;
    select coalesce(sum(l.qty_on_hand), 0)::integer into v_available from public.inventory_lots l
      where l.item_id = v_line.item_id and l.qty_on_hand > 0 and l.received_date <= v_today
        and (l.expiry_date is null or l.expiry_date >= v_today);
    if v_available < v_line.quantity then
      raise exception 'Only % of % % available. Update the pickup quantity.',
        v_available, lower(v_item.name), case when v_available = 1 then 'is' else 'are' end
        using errcode = '23514';
    end if;
    v_remaining := v_line.quantity;
    for v_lot in
      select l.id, l.qty_on_hand from public.inventory_lots l
      where l.item_id = v_line.item_id and l.qty_on_hand > 0 and l.received_date <= v_today
        and (l.expiry_date is null or l.expiry_date >= v_today)
      order by l.expiry_date nulls last, l.received_date, l.id
    loop
      exit when v_remaining = 0;
      v_take := least(v_remaining, v_lot.qty_on_hand);
      update public.inventory_lots set qty_on_hand = qty_on_hand - v_take where id = v_lot.id;
      insert into public.distribution_lines(distribution_id, item_id, lot_id, quantity)
        values (v_distribution.id, v_line.item_id, v_lot.id, v_take);
      insert into public.stock_adjustments(lot_id, quantity_change, quantity_after, reason, actor_id, kind)
        values (v_lot.id, -v_take, v_lot.qty_on_hand - v_take, 'Distribution', v_actor, 'distribution');
      v_remaining := v_remaining - v_take;
    end loop;
    v_units := v_units + v_line.quantity;
  end loop;

  if v_request.id is not null then
    update public.food_requests set status = 'completed', updated_at = now() where id = v_request.id;
  end if;

  -- A completed ID check verifies the student ID the student registered with.
  if p_id_checked then
    if v_profile_id is not null and v_profile.student_id is null and v_profile.claimed_student_id is not null then
      begin
        perform private.set_student_id(v_profile_id, v_profile.claimed_student_id, true);
      exception when unique_violation then
        null; -- Another account already holds this ID; an admin can resolve it later.
      end;
    elsif v_provisional_id is not null and v_provisional.id_checked_at is null then
      update public.provisional_students set id_checked_at = now(), id_checked_by = v_actor
        where id = v_provisional_id;
    end if;
  end if;

  perform private.log_action(
    case when v_request.id is not null then 'Pickup completed' else 'Walk-in pickup completed' end,
    'distribution', v_distribution.id::text,
    case when v_request.id is not null then 'Request · ' else 'Walk-in · ' end || v_name,
    v_units || case when v_units = 1 then ' unit' else ' units' end || ' handed out'
      || case when v_request.id is not null then ' · Approved → Completed' else '' end);
  return v_distribution;
end;
$$;

-- Reports and audit ----------------------------------------------------------------------

create function private.monthly_report(p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_first date;
  v_last date;
  v_start timestamptz;
  v_end timestamptz;
  v_completed integer;
begin
  perform private.require_role(array['admin'], 'Administrator access required');
  if p_month is null then raise exception 'Choose a month.' using errcode = '22023'; end if;
  v_first := make_date(extract(year from p_month)::integer, extract(month from p_month)::integer, 1);
  v_last := (v_first + interval '1 month')::date - 1;
  v_start := v_first::timestamp at time zone 'America/Chicago';
  v_end := (v_last + 1)::timestamp at time zone 'America/Chicago';
  select count(*)::integer into v_completed from public.distributions d
    where d.distributed_at >= v_start and d.distributed_at < v_end;
  return jsonb_build_object(
    'students', (select count(distinct coalesce(d.profile_id::text, 'walk-in:' || d.provisional_student_id::text))
      from public.distributions d where d.distributed_at >= v_start and d.distributed_at < v_end),
    'completed', v_completed,
    'units', (select coalesce(sum(l.quantity), 0) from public.distribution_lines l
      join public.distributions d on d.id = l.distribution_id
      where d.distributed_at >= v_start and d.distributed_at < v_end),
    'donations', (select count(*) from public.donations dn where dn.received_on between v_first and v_last),
    'expired', (select coalesce(sum(l.qty_on_hand), 0) from public.inventory_lots l
      where l.expiry_date between v_first and v_last and l.expiry_date < private.pantry_today()),
    'results', jsonb_build_array(
      jsonb_build_array('Completed', v_completed),
      jsonb_build_array('No-show', (select count(*) from public.food_requests r join public.pickup_slots s on s.id = r.slot_id
        where r.status = 'no_show' and s.starts_at >= v_start and s.starts_at < v_end)),
      jsonb_build_array('Cancelled', (select count(*) from public.food_requests r join public.pickup_slots s on s.id = r.slot_id
        where r.status = 'cancelled' and s.starts_at >= v_start and s.starts_at < v_end)),
      jsonb_build_array('Declined', (select count(*) from public.food_requests r join public.pickup_slots s on s.id = r.slot_id
        where r.status = 'declined' and s.starts_at >= v_start and s.starts_at < v_end))),
    'items', (select coalesce(jsonb_agg(jsonb_build_array(t.name, t.units) order by t.units desc, t.name), '[]'::jsonb)
      from (select i.name, sum(l.quantity)::integer as units from public.distribution_lines l
            join public.distributions d on d.id = l.distribution_id
            join public.inventory_items i on i.id = l.item_id
            where d.distributed_at >= v_start and d.distributed_at < v_end
            group by i.name order by units desc, i.name limit 5) t));
end;
$$;

create function private.report_months() returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role(array['admin'], 'Administrator access required');
  return array(
    select m from (
      select to_char(d.distributed_at at time zone 'America/Chicago', 'YYYY-MM') as m from public.distributions d
      union select to_char(dn.received_on, 'YYYY-MM') from public.donations dn
      union select to_char(s.starts_at at time zone 'America/Chicago', 'YYYY-MM') from public.pickup_slots s
      union select to_char(private.pantry_today(), 'YYYY-MM')
    ) months order by m desc);
end;
$$;

-- All staff/admin actions, newest first, from the general log and the specialized ledgers.
create function private.audit_entries(p_limit integer)
returns table(id text, created_at timestamptz, actor text, action text, record text, change text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_role(array['admin'], 'Administrator access required');
  return query select e.id, e.created_at, e.actor, e.action, e.record, e.change from (
      select 'log-' || l.id as id, l.created_at, coalesce(nullif(p.display_name, ''), 'System') as actor,
        l.action, l.record, l.change
      from public.audit_log l left join public.profiles p on p.id = l.actor_id
      union all
      select 'access-' || a.id, a.created_at, coalesce(nullif(p.display_name, ''), 'System'),
        case when a.old_role <> a.new_role then 'Role changed'
             when a.new_enabled then 'Account activated' else 'Account deactivated' end,
        'User · ' || coalesce(nullif(t.display_name, ''), 'Unknown user'),
        concat_ws(' · ',
          case when a.old_role <> a.new_role then a.old_role || ' → ' || a.new_role end,
          case when a.old_enabled <> a.new_enabled then
            case when a.new_enabled then 'Inactive → Active' else 'Active → Inactive' end end)
      from public.access_audit a
      left join public.profiles p on p.id = a.actor_id
      left join public.profiles t on t.id = a.target_id
      union all
      select 'student-id-' || s.id, s.created_at, coalesce(nullif(p.display_name, ''), 'System'),
        'Student ID verified', 'Student · ' || coalesce(nullif(t.display_name, ''), 'Unknown student'),
        coalesce(s.old_student_id, 'none') || ' → ' || s.new_student_id
      from public.student_id_audit s
      left join public.profiles p on p.id = s.actor_id
      left join public.profiles t on t.id = s.target_id
      union all
      select 'stock-' || sa.id, sa.created_at, coalesce(nullif(p.display_name, ''), 'System'),
        'Stock adjusted', 'Inventory · ' || i.name,
        case when sa.quantity_change > 0 then '+' else '' end || sa.quantity_change || ' ' || i.unit
          || ' · ' || sa.reason
      from public.stock_adjustments sa
      join public.inventory_lots lot on lot.id = sa.lot_id
      join public.inventory_items i on i.id = lot.item_id
      left join public.profiles p on p.id = sa.actor_id
      where sa.kind = 'adjustment'
    ) e
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 1000), 1), 5000);
end;
$$;

-- Public API (security invoker wrappers) ----------------------------------------------------

create function public.admin_list_accounts()
returns table(user_id uuid, display_name text, email text, student_id text, claimed_student_id text,
  role text, enabled boolean, last_sign_in_at timestamptz, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.list_accounts(); $$;

create function public.staff_list_students()
returns table(kind text, id uuid, full_name text, student_id text, id_verified boolean,
  id_checked_at timestamptz, enabled boolean, last_pickup_at timestamptz,
  latest_request_status text, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.list_students(); $$;

create function public.staff_find_student(p_student_id text)
returns table(kind text, id uuid, full_name text, student_id text, id_verified boolean, has_pickups boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.find_student(p_student_id);
$$;

create function public.staff_create_provisional_student(p_student_id text, p_full_name text,
  p_id_checked boolean default false)
returns public.provisional_students
language sql security invoker set search_path = '' as $$
  select private.create_provisional_student(p_student_id, p_full_name, p_id_checked);
$$;

create function public.staff_check_provisional_id(p_provisional_student_id uuid)
returns public.provisional_students
language sql security invoker set search_path = '' as $$
  select private.check_provisional_id(p_provisional_student_id);
$$;

create function public.pickup_slot_availability(p_from date, p_to date)
returns table(id uuid, starts_at timestamptz, ends_at timestamptz, capacity integer, booked integer)
language sql stable security invoker set search_path = '' as $$
  select * from private.slot_availability(p_from, p_to);
$$;

create function public.staff_create_pickup_slots(p_date date, p_start time, p_end time,
  p_interval_minutes integer, p_capacity integer)
returns setof public.pickup_slots
language sql security invoker set search_path = '' as $$
  select * from private.create_slots(p_date, p_start, p_end, p_interval_minutes, p_capacity);
$$;

create function public.staff_update_pickup_slot(p_slot_id uuid, p_capacity integer)
returns public.pickup_slots
language sql security invoker set search_path = '' as $$
  select private.update_slot_capacity(p_slot_id, p_capacity);
$$;

create function public.submit_food_request(p_slot_id uuid, p_item_id uuid, p_note text default '')
returns public.food_requests
language sql security invoker set search_path = '' as $$
  select private.submit_request(p_slot_id, p_item_id, p_note);
$$;

create function public.cancel_food_request(p_request_id uuid)
returns public.food_requests
language sql security invoker set search_path = '' as $$ select private.cancel_request(p_request_id); $$;

create function public.my_food_requests()
returns table(id uuid, status text, created_at timestamptz, slot_id uuid, slot_starts_at timestamptz,
  slot_ends_at timestamptz, item_id uuid, item_name text, categories text[], pickup_note text,
  decline_reason text, completed_at timestamptz, items jsonb)
language sql stable security invoker set search_path = '' as $$ select * from private.my_requests(); $$;

create function public.staff_list_requests(p_since timestamptz default null)
returns table(id uuid, status text, created_at timestamptz, profile_id uuid, student_name text,
  student_id text, id_verified boolean, first_visit boolean, slot_id uuid, slot_starts_at timestamptz,
  slot_ends_at timestamptz, item_id uuid, item_name text, categories text[], pickup_note text,
  decline_reason text, decided_by_name text, decided_at timestamptz, items jsonb)
language sql stable security invoker set search_path = '' as $$
  select * from private.list_requests(p_since);
$$;

create function public.staff_decide_request(p_request_id uuid, p_approve boolean, p_reason text default null)
returns public.food_requests
language sql security invoker set search_path = '' as $$
  select private.decide_request(p_request_id, p_approve, p_reason);
$$;

create function public.staff_mark_no_show(p_request_id uuid)
returns public.food_requests
language sql security invoker set search_path = '' as $$ select private.mark_no_show(p_request_id); $$;

create function public.staff_pickups(p_date date)
returns table(request_id uuid, distribution_id uuid, kind text, recipient_id uuid, student_name text,
  student_id text, id_verified boolean, first_visit boolean, status text, slot_id uuid,
  slot_starts_at timestamptz, slot_ends_at timestamptz, slot_capacity integer, slot_booked integer,
  pickup_note text, item_name text, distributed_at timestamptz, items jsonb)
language sql stable security invoker set search_path = '' as $$
  select * from private.pickups_for_day(p_date);
$$;

create function public.staff_create_inventory_item(p_name text, p_category text, p_unit text,
  p_low_stock_threshold integer, p_quantity integer default 0, p_storage_location text default null,
  p_expiry_date date default null)
returns public.inventory_items
language sql security invoker set search_path = '' as $$
  select private.create_item(p_name, p_category, p_unit, p_low_stock_threshold, p_quantity,
    p_storage_location, p_expiry_date);
$$;

create function public.staff_update_inventory_item(p_item_id uuid, p_name text, p_category text,
  p_unit text, p_low_stock_threshold integer)
returns public.inventory_items
language sql security invoker set search_path = '' as $$
  select private.update_item(p_item_id, p_name, p_category, p_unit, p_low_stock_threshold);
$$;

create function public.staff_set_lot_quantity(p_lot_id uuid, p_quantity integer, p_reason text)
returns public.inventory_lots
language sql security invoker set search_path = '' as $$
  select private.set_lot_quantity(p_lot_id, p_quantity, p_reason);
$$;

create function public.staff_record_donation(p_received_on date, p_donors text[], p_lines jsonb)
returns public.donations
language sql security invoker set search_path = '' as $$
  select private.record_donation(p_received_on, p_donors, p_lines);
$$;

create function public.staff_complete_distribution(p_request_id uuid default null,
  p_profile_id uuid default null, p_provisional_student_id uuid default null,
  p_items jsonb default '[]'::jsonb, p_id_checked boolean default false)
returns public.distributions
language sql security invoker set search_path = '' as $$
  select private.complete_distribution(p_request_id, p_profile_id, p_provisional_student_id,
    p_items, p_id_checked);
$$;

create function public.admin_monthly_report(p_month date) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.monthly_report(p_month); $$;

create function public.admin_report_months() returns text[]
language sql stable security invoker set search_path = '' as $$ select private.report_months(); $$;

create function public.admin_audit_entries(p_limit integer default 1000)
returns table(id text, created_at timestamptz, actor text, action text, record text, change text)
language sql stable security invoker set search_path = '' as $$
  select * from private.audit_entries(p_limit);
$$;

-- Privileges --------------------------------------------------------------------------------

-- Internal helpers: only callable from other security definer functions.
revoke all on function private.pantry_today(), private.require_role(text[], text),
  private.log_action(text, text, text, text, text, jsonb), private.link_provisional_student(),
  private.slot_booked(uuid), private.status_label(text), private.distribution_items(uuid)
  from public, anon, authenticated;

-- API functions: role checks happen inside each private function.
revoke all on function
  private.list_accounts(), private.list_students(), private.find_student(text),
  private.create_provisional_student(text, text, boolean), private.check_provisional_id(uuid),
  private.slot_availability(date, date), private.create_slots(date, time, time, integer, integer),
  private.update_slot_capacity(uuid, integer), private.submit_request(uuid, uuid, text),
  private.cancel_request(uuid), private.decide_request(uuid, boolean, text), private.mark_no_show(uuid),
  private.my_requests(), private.list_requests(timestamptz), private.pickups_for_day(date),
  private.create_item(text, text, text, integer, integer, text, date),
  private.update_item(uuid, text, text, text, integer), private.set_lot_quantity(uuid, integer, text),
  private.record_donation(date, text[], jsonb),
  private.complete_distribution(uuid, uuid, uuid, jsonb, boolean),
  private.monthly_report(date), private.report_months(), private.audit_entries(integer),
  public.admin_list_accounts(), public.staff_list_students(), public.staff_find_student(text),
  public.staff_create_provisional_student(text, text, boolean), public.staff_check_provisional_id(uuid),
  public.pickup_slot_availability(date, date),
  public.staff_create_pickup_slots(date, time, time, integer, integer),
  public.staff_update_pickup_slot(uuid, integer), public.submit_food_request(uuid, uuid, text),
  public.cancel_food_request(uuid), public.my_food_requests(), public.staff_list_requests(timestamptz),
  public.staff_decide_request(uuid, boolean, text), public.staff_mark_no_show(uuid),
  public.staff_pickups(date),
  public.staff_create_inventory_item(text, text, text, integer, integer, text, date),
  public.staff_update_inventory_item(uuid, text, text, text, integer),
  public.staff_set_lot_quantity(uuid, integer, text), public.staff_record_donation(date, text[], jsonb),
  public.staff_complete_distribution(uuid, uuid, uuid, jsonb, boolean),
  public.admin_monthly_report(date), public.admin_report_months(), public.admin_audit_entries(integer)
  from public, anon;
grant execute on function
  private.list_accounts(), private.list_students(), private.find_student(text),
  private.create_provisional_student(text, text, boolean), private.check_provisional_id(uuid),
  private.slot_availability(date, date), private.create_slots(date, time, time, integer, integer),
  private.update_slot_capacity(uuid, integer), private.submit_request(uuid, uuid, text),
  private.cancel_request(uuid), private.decide_request(uuid, boolean, text), private.mark_no_show(uuid),
  private.my_requests(), private.list_requests(timestamptz), private.pickups_for_day(date),
  private.create_item(text, text, text, integer, integer, text, date),
  private.update_item(uuid, text, text, text, integer), private.set_lot_quantity(uuid, integer, text),
  private.record_donation(date, text[], jsonb),
  private.complete_distribution(uuid, uuid, uuid, jsonb, boolean),
  private.monthly_report(date), private.report_months(), private.audit_entries(integer),
  public.admin_list_accounts(), public.staff_list_students(), public.staff_find_student(text),
  public.staff_create_provisional_student(text, text, boolean), public.staff_check_provisional_id(uuid),
  public.pickup_slot_availability(date, date),
  public.staff_create_pickup_slots(date, time, time, integer, integer),
  public.staff_update_pickup_slot(uuid, integer), public.submit_food_request(uuid, uuid, text),
  public.cancel_food_request(uuid), public.my_food_requests(), public.staff_list_requests(timestamptz),
  public.staff_decide_request(uuid, boolean, text), public.staff_mark_no_show(uuid),
  public.staff_pickups(date),
  public.staff_create_inventory_item(text, text, text, integer, integer, text, date),
  public.staff_update_inventory_item(uuid, text, text, text, integer),
  public.staff_set_lot_quantity(uuid, integer, text), public.staff_record_donation(date, text[], jsonb),
  public.staff_complete_distribution(uuid, uuid, uuid, jsonb, boolean),
  public.admin_monthly_report(date), public.admin_report_months(), public.admin_audit_entries(integer)
  to authenticated;
