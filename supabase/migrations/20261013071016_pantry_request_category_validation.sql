create function private.valid_categories(categories text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select cardinality(categories) between 1 and 10 and
    not exists(select 1 from unnest(categories) category
      where category is null or char_length(btrim(category)) = 0 or char_length(category) > 100);
$$;
revoke all on function private.valid_categories(text[]) from public, anon;
grant execute on function private.valid_categories(text[]) to authenticated;
alter table public.food_requests add constraint valid_requested_categories
check (private.valid_categories(requested_categories));
