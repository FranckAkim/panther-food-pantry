-- Optional photo for each inventory item.
--
-- Photos are files in the public `item-images` Storage bucket, stored as `<item id>/<file name>`;
-- `inventory_items.image_path` holds that path. Anyone with a photo's link can view it (photos
-- show products, nothing personal). Only staff and admins can upload or delete files, and only
-- `staff_set_item_image()` changes which photo an item uses.

alter table public.inventory_items add column image_path text
  constraint inventory_items_image_path_format check (
    image_path is null or image_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$');

-- Storage bucket: images only, up to 2 MB each (the app uploads ~100 KB WebP files).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Staff and admins may upload into an existing item's folder, and list or delete files there.
-- Public links serve files without these policies; uploads use new names, so no update policy.
create policy pantry_item_images_staff_select on storage.objects for select to authenticated
using (bucket_id = 'item-images' and (select private.current_role()) in ('staff','admin'));

create policy pantry_item_images_staff_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'item-images'
  and (select private.current_role()) in ('staff','admin')
  and name ~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$'
  -- Qualified: inside the subquery a bare `name` would mean the item's name.
  and exists (select 1 from public.inventory_items i where i.id::text = split_part(objects.name, '/', 1))
);

create policy pantry_item_images_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'item-images' and (select private.current_role()) in ('staff','admin'));

-- Sets or clears an item's photo. The file must already be uploaded to the item's folder.
-- Returns the previous path (null if none or unchanged) so the app can delete that file.
create function private.set_item_image(p_item_id uuid, p_image_path text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.inventory_items;
  v_path text := nullif(btrim(coalesce(p_image_path, '')), '');
begin
  perform private.require_role(array['staff','admin'], 'Staff access required');
  select * into v_item from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'Item not found.' using errcode = 'P0002'; end if;
  if v_path is not null then
    if split_part(v_path, '/', 1) <> p_item_id::text
      or v_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9][A-Za-z0-9._-]{0,150}$' then
      raise exception 'This photo belongs to a different item.' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'item-images' and o.name = v_path) then
      raise exception 'The photo did not finish uploading. Try again.' using errcode = '22023';
    end if;
  end if;
  if v_item.image_path is not distinct from v_path then return null; end if;
  update public.inventory_items set image_path = v_path where id = p_item_id;
  perform private.log_action('Inventory item updated', 'inventory_item', p_item_id::text,
    'Inventory · ' || v_item.name,
    case when v_path is null then 'photo removed'
         when v_item.image_path is null then 'photo added'
         else 'photo changed' end);
  return v_item.image_path;
end;
$$;

create function public.staff_set_item_image(p_item_id uuid, p_image_path text) returns text
language sql security invoker set search_path = '' as $$
  select private.set_item_image(p_item_id, p_image_path);
$$;

revoke all on function private.set_item_image(uuid, text), public.staff_set_item_image(uuid, text)
  from public, anon;
grant execute on function private.set_item_image(uuid, text), public.staff_set_item_image(uuid, text)
  to authenticated;

-- Students choose food from available_inventory(); add each item's photo. Recreated because the
-- result columns change. Dates now use pantry time, like the other pantry functions.
drop function public.available_inventory();
drop function private.available_inventory();

create function private.available_inventory()
returns table(item_id uuid, name text, category text, unit text, available boolean, image_path text)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := private.pantry_today();
begin
  if private.current_role() is null then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  return query
    select i.id, i.name, i.category, i.unit, true, i.image_path
    from public.inventory_items i
    where i.active and exists (
      select 1 from public.inventory_lots l
      where l.item_id = i.id and l.qty_on_hand > 0 and l.received_date <= v_today
        and (l.expiry_date is null or l.expiry_date >= v_today))
    order by i.name;
end;
$$;

create function public.available_inventory()
returns table(item_id uuid, name text, category text, unit text, available boolean, image_path text)
language sql stable security invoker set search_path = '' as $$
  select * from private.available_inventory();
$$;

revoke all on function private.available_inventory(), public.available_inventory() from public, anon;
grant execute on function private.available_inventory(), public.available_inventory() to authenticated;
