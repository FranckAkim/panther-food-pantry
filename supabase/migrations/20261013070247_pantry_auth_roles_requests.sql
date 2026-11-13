-- PFPMS-1 through PFPMS-4. Supabase Auth owns passwords and sessions.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  student_id text unique check (student_id is null or char_length(student_id) between 1 and 30),
  created_at timestamptz not null default now()
);
create table private.user_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'student' check (role in ('student','staff','admin')),
  enabled boolean not null default true
);
create table public.access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  old_role text not null, new_role text not null,
  old_enabled boolean not null, new_enabled boolean not null,
  created_at timestamptz not null default now()
);
create index access_audit_actor_idx on public.access_audit(actor_id);
create index access_audit_target_idx on public.access_audit(target_id);
create table public.food_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles(id),
  requested_categories text[] not null,
  pickup_note text not null default '' check (char_length(pickup_note) <= 500),
  status text not null default 'submitted' check (status in ('submitted','approved','declined','completed','cancelled')),
  created_at timestamptz not null default now(),
  check (cardinality(requested_categories) between 1 and 10),
  check (array_position(requested_categories, null) is null)
);
create index food_requests_student_created_idx on public.food_requests(student_id, created_at desc);

alter table public.profiles enable row level security;
alter table private.user_access enable row level security;
alter table public.access_audit enable row level security;
alter table public.food_requests enable row level security;

create function private.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from private.user_access where user_id = auth.uid() and enabled;
$$;
revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated;

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'pvamu.edu' then
    raise exception 'A pvamu.edu email is required' using errcode = '23514';
  end if;
  insert into public.profiles(id, display_name)
    values(new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 100));
  insert into private.user_access(user_id) values(new.id);
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;
create trigger pantry_create_profile after insert on auth.users
for each row execute function private.create_profile();

create policy profile_read on public.profiles for select to authenticated
using ((select private.current_role()) is not null and
  (id = (select auth.uid()) or (select private.current_role()) in ('staff','admin')));
create policy profile_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select private.current_role()) is not null)
with check (id = (select auth.uid()) and (select private.current_role()) is not null);
create policy request_read on public.food_requests for select to authenticated
using ((select private.current_role()) is not null and
  (student_id = (select auth.uid()) or (select private.current_role()) in ('staff','admin')));
create policy request_submit on public.food_requests for insert to authenticated
with check ((select private.current_role()) = 'student' and student_id = (select auth.uid()) and status = 'submitted');
create policy audit_read on public.access_audit for select to authenticated
using ((select private.current_role()) = 'admin');

revoke all on public.profiles, public.food_requests, public.access_audit from anon, authenticated;
grant select on public.profiles, public.food_requests, public.access_audit to authenticated;
grant update(display_name, student_id) on public.profiles to authenticated;
grant insert(requested_categories, pickup_note) on public.food_requests to authenticated;

create function public.my_access() returns table(role text, enabled boolean)
language sql stable security invoker set search_path = '' as $$
  select private.current_role(), private.current_role() is not null;
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

create function private.list_users() returns table(user_id uuid, display_name text, student_id text, role text, enabled boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query select p.id, p.display_name, p.student_id, a.role, a.enabled
    from public.profiles p join private.user_access a on a.user_id = p.id order by p.created_at;
end;
$$;
create function public.admin_list_users() returns table(user_id uuid, display_name text, student_id text, role text, enabled boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.list_users(); $$;

create function private.change_access(target_user_id uuid, new_role text, new_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare previous private.user_access;
begin
  -- Serialize role changes so concurrent changes cannot remove the last admin.
  perform pg_catalog.pg_advisory_xact_lock(5318, 3);
  if private.current_role() is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if new_role is null or new_role not in ('student','staff','admin') or new_enabled is null then
    raise exception 'Invalid role or access status' using errcode = '22023';
  end if;
  select * into previous from private.user_access where user_id = target_user_id for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;
  if previous.role = 'admin' and previous.enabled and (new_role <> 'admin' or not new_enabled)
    and (select count(*) from private.user_access where role = 'admin' and enabled) <= 1 then
    raise exception 'Cannot remove the last enabled administrator' using errcode = '23514';
  end if;
  update private.user_access set role = new_role, enabled = new_enabled where user_id = target_user_id;
  insert into public.access_audit(actor_id,target_id,old_role,new_role,old_enabled,new_enabled)
    values(auth.uid(),target_user_id,previous.role,new_role,previous.enabled,new_enabled);
end;
$$;
create function public.admin_set_access(target_user_id uuid, new_role text, new_enabled boolean) returns void
language sql security invoker set search_path = '' as $$
  select private.change_access(target_user_id, new_role, new_enabled);
$$;
revoke all on function private.list_users(), public.admin_list_users(),
  private.change_access(uuid,text,boolean), public.admin_set_access(uuid,text,boolean) from public, anon;
grant execute on function private.list_users(), public.admin_list_users(),
  private.change_access(uuid,text,boolean), public.admin_set_access(uuid,text,boolean) to authenticated;
