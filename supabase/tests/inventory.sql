begin;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000011','pantry-stock-staff@pvamu.edu'),
('00000000-0000-4000-8000-000000000012','pantry-stock-student@pvamu.edu');
update private.user_access set role='staff' where user_id='00000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
do $$ declare item uuid; lot public.inventory_lots; begin
  insert into public.inventory_items(name,category) values('TEST beans','Canned food') returning id into item;
  select * into lot from public.create_inventory_lot(item,10,'Shelf A',current_date,current_date+30);
  perform public.adjust_inventory_stock(lot.id,-3,'Count correction');
  if (select qty_on_hand from public.inventory_lots where id=lot.id) <> 7 then raise exception 'Incorrect stock'; end if;
  if (select sum(quantity_change) from public.stock_adjustments where lot_id=lot.id) <> 7 then raise exception 'Ledger mismatch'; end if;
  begin
    perform public.adjust_inventory_stock(lot.id,-8,'Too much'); raise exception 'Negative stock allowed';
  exception when check_violation then null; end;
  begin
    perform public.adjust_inventory_stock(lot.id,1,''); raise exception 'Empty reason allowed';
  exception when check_violation then null; end;
  if (select qty_on_hand from public.inventory_lots where id=lot.id) <> 7 then raise exception 'Failed write was not atomic'; end if;
  begin
    update public.inventory_lots set qty_on_hand=100 where id=lot.id; raise exception 'Direct stock edit allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_inventory_lot(item,1,'Shelf A',current_date,current_date-1); raise exception 'Invalid dates allowed';
  exception when check_violation then null; end;
  update public.inventory_items set name='TEST updated beans' where id=item;
  update public.inventory_lots set storage_location='Shelf B' where id=lot.id;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.inventory_lots) <> 0 then raise exception 'Student read storage details'; end if;
  if (select count(*) from public.stock_adjustments) <> 0 then raise exception 'Student read staff history'; end if;
  if not exists(select 1 from public.available_inventory() where name='TEST updated beans') then raise exception 'Availability missing'; end if;
  begin
    insert into public.inventory_items(name,category) values('Forbidden','Produce'); raise exception 'Student added item';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_inventory_lot(gen_random_uuid(),1,'X',current_date,null); raise exception 'Student added lot';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update private.user_access set enabled=false where user_id='00000000-0000-4000-8000-000000000012';
set local role authenticated;
do $$ begin
  begin
    perform public.available_inventory(); raise exception 'Disabled account read availability';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.available_inventory(); raise exception 'Anonymous read availability';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Inventory and availability tests passed; fixtures rolled back' as result;
