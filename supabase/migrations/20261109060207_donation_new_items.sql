-- Donations can add items that are not in the inventory yet.
--
-- Each p_lines entry gives either an existing item ({item_id, ...}, unchanged) or a new one:
--   {new_item: {name, category, unit, low_stock_threshold}, quantity, expiry_date, storage_location}
-- New items are created in the same transaction as the donation, so a donation that fails
-- leaves no stray items. A new item's name must not match an active item, and each new item
-- appears once per donation. The signature and return type are unchanged, so existing callers
-- and grants keep working. The audit entry now says "1 unit" rather than "1 units".

create or replace function private.record_donation(p_received_on date, p_donors text[], p_lines jsonb)
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
  v_new jsonb;
  v_new_name text;
  v_new_category text;
  v_new_unit text;
  v_new_names text[] := '{}';
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
    v_new := v_line -> 'new_item';
    if jsonb_typeof(v_new) = 'object' then
      v_new_name := btrim(coalesce(v_new->>'name', ''));
      v_new_category := btrim(coalesce(v_new->>'category', ''));
      v_new_unit := btrim(coalesce(v_new->>'unit', ''));
      if char_length(v_new_name) not between 1 and 120 then
        raise exception 'Enter a name (up to 120 characters) for the new item in item %.', v_index + 1
          using errcode = '22023';
      end if;
      if char_length(v_new_category) not between 1 and 80 then
        raise exception 'Choose a category for the new item in item %.', v_index + 1 using errcode = '22023';
      end if;
      if char_length(v_new_unit) not between 1 and 30 then
        raise exception 'Enter how the new item in item % is counted, for example cans.', v_index + 1
          using errcode = '22023';
      end if;
      if coalesce(v_new->>'low_stock_threshold', '') !~ '^[0-9]{1,6}$'
          or (v_new->>'low_stock_threshold')::integer > 100000 then
        raise exception 'Enter a low-stock alert of 0 or more for item %.', v_index + 1 using errcode = '22023';
      end if;
      if lower(v_new_name) = any(v_new_names) then
        raise exception 'Item % adds "%" again. Add each new item once.', v_index + 1, v_new_name
          using errcode = '22023';
      end if;
      if exists(select 1 from public.inventory_items i where i.active and lower(btrim(i.name)) = lower(v_new_name)) then
        raise exception '"%" is already in the inventory. Choose it from the list for item %.', v_new_name, v_index + 1
          using errcode = '23505';
      end if;
      insert into public.inventory_items(name, category, unit, low_stock_threshold)
        values (v_new_name, v_new_category, v_new_unit, (v_new->>'low_stock_threshold')::integer)
        returning id into v_item_id;
      v_new_names := v_new_names || lower(v_new_name);
      perform private.log_action('Inventory item added', 'inventory_item', v_item_id::text,
        'Inventory · ' || v_new_name, 'Added with a donation');
    else
      select i.id into v_item_id from public.inventory_items i
        where i.id::text = v_line->>'item_id' and i.active;
      if v_item_id is null then
        raise exception 'Choose an inventory item for item %.', v_index + 1 using errcode = '22023';
      end if;
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
    v_count || case when v_count = 1 then ' lot' else ' lots' end || ' added · '
      || v_units || case when v_units = 1 then ' unit' else ' units' end);
  return v_donation;
end;
$$;
