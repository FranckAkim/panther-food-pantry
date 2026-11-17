-- Upgrade existing projects: student IDs are assigned only after a staff ID check.
-- Fresh projects already include these definitions in schema.sql.
revoke update on public.profiles from authenticated;
revoke update(student_id) on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;

create table public.student_id_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  old_student_id text,
  new_student_id text not null,
  identification_checked boolean not null check (identification_checked),
  created_at timestamptz not null default now()
);
create index student_id_audit_actor_idx on public.student_id_audit(actor_id);
create index student_id_audit_target_idx on public.student_id_audit(target_id);
alter table public.student_id_audit enable row level security;
revoke all on public.student_id_audit from public, anon, authenticated;
grant select on public.student_id_audit to authenticated;
create policy student_id_audit_read on public.student_id_audit for select to authenticated
using ((select private.current_role()) in ('staff','admin'));

create function private.set_student_id(target uuid, new_student_id text, identification_checked boolean)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare previous public.profiles; updated public.profiles; normalized_id text;
begin
  if auth.uid() is null or private.current_role() is null or private.current_role() not in ('staff','admin') then
    raise exception 'Staff or administrator access required' using errcode = '42501';
  end if;
  if identification_checked is distinct from true then
    raise exception 'Check the physical student ID before assigning its number' using errcode = '22023';
  end if;
  normalized_id := upper(btrim(new_student_id));
  if normalized_id is null or char_length(normalized_id) not between 1 and 30 then
    raise exception 'Student ID must contain 1 to 30 characters' using errcode = '22023';
  end if;
  select * into previous from public.profiles where id = target for update;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if previous.student_id is not distinct from normalized_id then return previous; end if;
  update public.profiles set student_id = normalized_id where id = target returning * into updated;
  insert into public.student_id_audit(actor_id,target_id,old_student_id,new_student_id,identification_checked)
    values(auth.uid(),target,previous.student_id,normalized_id,true);
  return updated;
end;
$$;
create function public.staff_set_student_id(target uuid, new_student_id text, identification_checked boolean default false)
returns public.profiles language sql security invoker set search_path = '' as $$
  select private.set_student_id(target,new_student_id,identification_checked);
$$;
revoke all on function private.set_student_id(uuid,text,boolean), public.staff_set_student_id(uuid,text,boolean)
from public, anon;
grant execute on function private.set_student_id(uuid,text,boolean), public.staff_set_student_id(uuid,text,boolean)
to authenticated;
