-- Runs only in the disposable SQL runner. All fixtures are rolled back.
begin;
select gen_random_uuid() student,gen_random_uuid() other,gen_random_uuid() staff,gen_random_uuid() item,
  gen_random_uuid() slot,gen_random_uuid() request,gen_random_uuid() donation \gset
insert into auth.users(id,email) values(:'student','workflow-student@pvamu.edu'),(:'other','workflow-other@pvamu.edu'),(:'staff','workflow-staff@pvamu.edu');
update private.user_access set role='staff' where user_id=:'staff';
select set_config('test.student',:'student',true),set_config('test.other',:'other',true),set_config('test.item',:'item',true),set_config('test.slot',:'slot',true),set_config('test.request',:'request',true),set_config('test.donation',:'donation',true);
insert into public.inventory_items(id,name,category) values(:'item','Workflow item','Workflow');
select set_config('request.jwt.claims',json_build_object('sub',:'staff','role','authenticated')::text,true);
set local role authenticated;
select public.save_pickup_slot(:'slot',now()+interval '1 day',1,true);
select public.receive_donation(:'donation','Workflow donor',current_date,jsonb_build_array(jsonb_build_object('item_id',:'item','quantity',2,'storage_location','Test')));
select public.receive_donation(:'donation','Workflow donor',current_date,jsonb_build_array(jsonb_build_object('item_id',:'item','quantity',2,'storage_location','Test')));
do $$ begin
  assert (select sum(qty_on_hand) from public.inventory_lots where item_id=current_setting('test.item')::uuid)=2,'Donation retry duplicated stock';
  begin
    perform public.receive_donation(gen_random_uuid(),'Bad donation',current_date,jsonb_build_array(
      jsonb_build_object('item_id',current_setting('test.item'),'quantity',1,'storage_location','Test'),
      jsonb_build_object('item_id',current_setting('test.item'),'quantity',-1,'storage_location','Test')));
    raise exception 'Invalid donation accepted';
  exception when invalid_parameter_value then null; end;
  assert (select sum(qty_on_hand) from public.inventory_lots where item_id=current_setting('test.item')::uuid)=2,'Donation partially committed';
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',:'student','role','authenticated')::text,true);
set local role authenticated;
select public.submit_food_request(:'request',array['Workflow'],:'slot','');
do $$ begin
  begin
    perform public.submit_food_request(gen_random_uuid(),array['Workflow'],current_setting('test.slot')::uuid,'');
    raise exception 'Duplicate open request accepted';
  exception when check_violation then null; end;
  begin
    perform public.transition_food_request(current_setting('test.request')::uuid,'approved','');
    raise exception 'Student approved request';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.food_requests(requested_categories) values(array['Workflow']);
    raise exception 'Direct request bypass accepted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',:'other','role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.food_requests)=0,'Cross-student data leaked';
  begin
    perform public.submit_food_request(gen_random_uuid(),array['Workflow'],current_setting('test.slot')::uuid,'');
    raise exception 'Full slot accepted';
  exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',:'staff','role','authenticated')::text,true);
set local role authenticated;
select public.transition_food_request(:'request','approved','');
select public.staff_set_student_id(:'student','WORKFLOW-123',true);
do $$ begin
  begin
    perform public.complete_pickup(current_setting('test.request')::uuid,jsonb_build_array(jsonb_build_object('item_id',current_setting('test.item'),'quantity',3)),true);
    raise exception 'Short stock accepted';
  exception when check_violation then null; end;
  assert (select sum(qty_on_hand) from public.inventory_lots where item_id=current_setting('test.item')::uuid)=2,'Failed pickup deducted stock';
end $$;
select public.complete_pickup(:'request',jsonb_build_array(jsonb_build_object('item_id',:'item','quantity',1)),true);
select public.complete_pickup(:'request',jsonb_build_array(jsonb_build_object('item_id',:'item','quantity',1)),true);
do $$ begin
  assert (select sum(qty_on_hand) from public.inventory_lots where item_id=current_setting('test.item')::uuid)=1,'Duplicate pickup deducted stock';
  assert (select sum(quantity) from public.pickup_lines where request_id=current_setting('test.request')::uuid)=1,'Pickup ledger mismatch';
  assert (select booked from public.list_pickup_slots() where id=current_setting('test.slot')::uuid)=0,'Completed request held slot';
end $$;
rollback;
select 'workflow tests passed; fixtures rolled back';
