-- staff_pickups() also returns the id of the food the student requested (`item_id`, last column),
-- so the hand-out screen can start with that food listed. Recreated because the result columns
-- change; the body is otherwise unchanged and walk-ins return null.

drop function public.staff_pickups(date);
drop function private.pickups_for_day(date);

-- One day's pickups: approved/completed/no-show requests in that day's slots, plus walk-ins.
create function private.pickups_for_day(p_date date)
returns table(request_id uuid, distribution_id uuid, kind text, recipient_id uuid, student_name text,
  student_id text, id_verified boolean, first_visit boolean, status text, slot_id uuid,
  slot_starts_at timestamptz, slot_ends_at timestamptz, slot_capacity integer, slot_booked integer,
  pickup_note text, item_name text, distributed_at timestamptz, items jsonb, item_id uuid)
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
      case when d.id is null then '[]'::jsonb else private.distribution_items(d.id) end,
      i.id
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
      ''::text, null::text, d.distributed_at, private.distribution_items(d.id), null::uuid
    from public.distributions d
    left join public.profiles p on p.id = d.profile_id
    left join public.provisional_students ps on ps.id = d.provisional_student_id
    where d.request_id is null and d.distributed_at >= v_start and d.distributed_at < v_end
    order by 11 nulls last, 5;
end;
$$;

create function public.staff_pickups(p_date date)
returns table(request_id uuid, distribution_id uuid, kind text, recipient_id uuid, student_name text,
  student_id text, id_verified boolean, first_visit boolean, status text, slot_id uuid,
  slot_starts_at timestamptz, slot_ends_at timestamptz, slot_capacity integer, slot_booked integer,
  pickup_note text, item_name text, distributed_at timestamptz, items jsonb, item_id uuid)
language sql stable security invoker set search_path = '' as $$
  select * from private.pickups_for_day(p_date);
$$;

revoke all on function private.pickups_for_day(date), public.staff_pickups(date) from public, anon;
grant execute on function private.pickups_for_day(date), public.staff_pickups(date) to authenticated;
