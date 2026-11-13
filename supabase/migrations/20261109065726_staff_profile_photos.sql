-- Staff and admins can set an optional profile photo too (students already could).
--
-- The `student-photos` bucket keeps its name (it already holds students' photos; renaming a bucket
-- means moving every file), but now holds every account's photo as `<profile id>/<file name>`.
-- Any active account uploads, reads, and deletes only in its own folder; staff and admins can read
-- every photo. Students still read only their own, so they never see staff photos.

drop policy pantry_student_photos_select on storage.objects;
drop policy pantry_student_photos_insert on storage.objects;
drop policy pantry_student_photos_delete on storage.objects;

create policy pantry_profile_photos_select on storage.objects for select to authenticated
using (
  bucket_id = 'student-photos'
  and (
    ((select private.current_role()) is not null and split_part(name, '/', 1) = (select auth.uid())::text)
    or (select private.current_role()) in ('staff','admin')
  )
);

create policy pantry_profile_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-photos'
  and (select private.current_role()) is not null
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$'
);

create policy pantry_profile_photos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'student-photos'
  and (select private.current_role()) is not null
  and split_part(name, '/', 1) = (select auth.uid())::text
);

-- Same as before, but for any active account. Signature unchanged, so grants are kept.
create or replace function private.set_my_profile_photo(p_photo_path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_previous text;
  v_path text := nullif(btrim(coalesce(p_photo_path, '')), '');
begin
  v_actor := private.require_role(array['student','staff','admin'], 'Active account required');
  select photo_path into v_previous from public.profiles where id = v_actor for update;
  if not found then raise exception 'Profile not found.' using errcode = 'P0002'; end if;
  if v_path is not null then
    if split_part(v_path, '/', 1) <> v_actor::text
      or v_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$' then
      raise exception 'This photo belongs to a different account.' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'student-photos' and o.name = v_path) then
      raise exception 'The photo did not finish uploading. Try again.' using errcode = '22023';
    end if;
  end if;
  if v_previous is not distinct from v_path then return null; end if;
  update public.profiles set photo_path = v_path where id = v_actor;
  return v_previous;
end;
$$;
