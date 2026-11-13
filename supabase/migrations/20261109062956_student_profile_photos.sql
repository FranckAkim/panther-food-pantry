-- Optional profile photo for students.
--
-- Students add, change, or remove their own photo from their profile; pantry staff and admins
-- see it beside the student's name (for example when confirming who is picking up food). Photos
-- are personal, so the `student-photos` bucket is private: files are served only through
-- short-lived signed links, which need these read policies. Files are stored as
-- `<profile id>/<file name>`; `profiles.photo_path` holds that path, and only
-- `set_my_profile_photo()` changes it (clients can update only `display_name` on profiles).

alter table public.profiles add column photo_path text
  constraint profiles_photo_path_format check (
    photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$');
-- Readable through the existing table-level select grant and profile_read policy: a student reads
-- their own row, staff and admins read every row.

-- Private bucket: images only, up to 1 MB each (the app uploads ~30 KB square WebP files).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A student reads, uploads, and deletes files only in their own folder; staff and admins read all.
-- Uploads use new names, so there is no update policy.
create policy pantry_student_photos_select on storage.objects for select to authenticated
using (
  bucket_id = 'student-photos'
  and (
    ((select private.current_role()) = 'student' and split_part(name, '/', 1) = (select auth.uid())::text)
    or (select private.current_role()) in ('staff','admin')
  )
);

create policy pantry_student_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-photos'
  and (select private.current_role()) = 'student'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$'
);

create policy pantry_student_photos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'student-photos'
  and (select private.current_role()) = 'student'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

-- Sets or clears the signed-in student's photo. The file must already be uploaded to their folder.
-- Returns the previous path (null if none or unchanged) so the app can delete that file.
create function private.set_my_profile_photo(p_photo_path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
  v_previous text;
  v_path text := nullif(btrim(coalesce(p_photo_path, '')), '');
begin
  v_actor := private.require_role(array['student'], 'Only student accounts can set a profile photo.');
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

create function public.set_my_profile_photo(p_photo_path text) returns text
language sql security invoker set search_path = '' as $$
  select private.set_my_profile_photo(p_photo_path);
$$;

revoke all on function private.set_my_profile_photo(text), public.set_my_profile_photo(text)
  from public, anon;
grant execute on function private.set_my_profile_photo(text), public.set_my_profile_photo(text)
  to authenticated;
