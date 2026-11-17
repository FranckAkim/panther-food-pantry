-- Student home page: availability per category without exposing quantities.
-- A category is out of stock when none of its items can be handed out, and low
-- when any item is below its low-stock threshold.
create function private.category_availability()
returns table(category text, status text)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := private.pantry_today();
begin
  if private.current_role() is null then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  return query
    with totals as (
      select i.category as item_category, i.low_stock_threshold,
        coalesce(sum(l.qty_on_hand) filter (where l.qty_on_hand > 0 and l.received_date <= v_today
          and (l.expiry_date is null or l.expiry_date >= v_today)), 0) as quantity
      from public.inventory_items i
      left join public.inventory_lots l on l.item_id = i.id
      where i.active
      group by i.id, i.category, i.low_stock_threshold
    )
    select t.item_category,
      case when bool_and(t.quantity = 0) then 'out_of_stock'
           when bool_or(t.quantity < t.low_stock_threshold) then 'low_stock'
           else 'in_stock' end
    from totals t
    group by t.item_category
    order by t.item_category;
end;
$$;

create function public.category_availability() returns table(category text, status text)
language sql stable security invoker set search_path = '' as $$
  select * from private.category_availability();
$$;

revoke all on function private.category_availability(), public.category_availability() from public, anon;
grant execute on function private.category_availability(), public.category_availability() to authenticated;
