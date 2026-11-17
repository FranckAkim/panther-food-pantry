-- The sample inventory added on 2026-11-02 was named "[DEMO] …". Drop that prefix so
-- staff and students see plain item names. Only names change: item ids, lots, stock,
-- requests, and history keep pointing at the same items.
update public.inventory_items
set name = btrim(regexp_replace(name, '^\[DEMO\]\s*', ''))
where name ~ '^\[DEMO\]';
