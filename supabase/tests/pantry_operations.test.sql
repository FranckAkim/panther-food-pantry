-- Pantry operations: workflow and access tests. Run with supabase/tests/run-local.sh.
-- Pattern: `select tests.act_as(user); set role authenticated;` ... `reset role;`

-- Accounts --------------------------------------------------------------------------------
select tests.remember('admin', '00000000-0000-4000-8000-00000000000a');
select tests.remember('staff', '00000000-0000-4000-8000-00000000000b');
select tests.remember('one', '00000000-0000-4000-8000-00000000000c');
select tests.remember('two', '00000000-0000-4000-8000-00000000000d');
select tests.remember('three', '00000000-0000-4000-8000-00000000000e');
select tests.remember('four', '00000000-0000-4000-8000-00000000000f');
insert into auth.users(id, email, raw_user_meta_data) values
  (tests.id('admin'), 'admin@pvamu.edu', '{"display_name":"Ada Admin"}'),
  (tests.id('staff'), 'staff@pvamu.edu', '{"display_name":"Sam Staff"}'),
  (tests.id('one'), 'one@pvamu.edu', '{"display_name":"Stu One","student_id":" p00000001 "}'),
  (tests.id('two'), 'two@pvamu.edu', '{"display_name":"Stu Two","student_id":"P00000002"}'),
  (tests.id('three'), 'three@pvamu.edu', '{"display_name":"Stu Three","student_id":"P00000099"}');
update private.user_access set role = 'admin' where user_id = tests.id('admin');
update private.user_access set role = 'staff' where user_id = tests.id('staff');

do $$ begin
  assert (select claimed_student_id from public.profiles where id = tests.id('one')) = 'P00000001',
    'registration stores the normalized claimed student ID';
  assert (select student_id from public.profiles where id = tests.id('one')) is null,
    'claimed student ID is not verified at registration';
end $$;
select tests.expect_error($$insert into auth.users(id, email) values (gen_random_uuid(), 'x@gmail.com')$$,
  'pvamu.edu email is required');

-- Inventory (staff) -----------------------------------------------------------------------
select tests.act_as(tests.id('staff'));
set role authenticated;
select tests.remember('beans', (public.staff_create_inventory_item('Canned beans', 'Canned goods', 'can', 5, 10,
  'A1', current_date + 30)).id);
select tests.remember('rice', (public.staff_create_inventory_item('Rice', 'Grains and pasta', 'bag', 2, 3, 'B1', null)).id);
select tests.remember('soap', (public.staff_create_inventory_item('Soap', 'Personal care', 'bar', 2, 0, null, null)).id);
select tests.remember('beans_soon', (public.create_inventory_lot(tests.id('beans'), 4, 'A2', current_date, current_date + 10)).id);
select tests.remember('beans_expired', (public.create_inventory_lot(tests.id('beans'), 7, 'A3', current_date - 60, current_date - 3)).id);
select tests.remember('beans_late', (select id from public.inventory_lots
  where item_id = tests.id('beans') and expiry_date = current_date + 30));
select tests.expect_error($$select public.staff_create_inventory_item('canned BEANS', 'Canned goods', 'can', 5, 0, null, null)$$,
  'already exists');
do $$ begin
  assert (select count(*) from public.inventory_lots where item_id = tests.id('soap')) = 0, 'no lot for zero opening stock';
  assert (select kind from public.stock_adjustments where lot_id = tests.id('beans_soon')) = 'initial',
    'create_inventory_lot records opening stock';
  assert (select received_quantity from public.inventory_lots where id = tests.id('beans_soon')) = 4,
    'lots keep the received quantity';
end $$;

-- Item photos (staff) ----------------------------------------------------------------------
-- Inserting into storage.objects stands in for an upload through the Storage API.
insert into storage.objects(bucket_id, name) values
  ('item-images', tests.id('beans') || '/a.webp'),
  ('item-images', tests.id('beans') || '/b.webp'),
  ('item-images', tests.id('rice') || '/r.webp');
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('item-images', gen_random_uuid() || '/x.webp')$$, 'row-level security');
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('item-images', tests.id('beans') || '/../x.webp')$$, 'row-level security');
select tests.expect_error($$select public.staff_set_item_image(tests.id('beans'), tests.id('beans') || '/missing.webp')$$,
  'did not finish uploading');
select tests.expect_error($$select public.staff_set_item_image(tests.id('beans'), tests.id('rice') || '/r.webp')$$,
  'different item');
do $$ begin
  assert public.staff_set_item_image(tests.id('beans'), tests.id('beans') || '/a.webp') is null,
    'first photo has no previous file';
  assert public.staff_set_item_image(tests.id('beans'), tests.id('beans') || '/b.webp') = tests.id('beans') || '/a.webp',
    'replacing a photo returns the old path to delete';
  assert public.staff_set_item_image(tests.id('beans'), tests.id('beans') || '/b.webp') is null,
    'setting the same photo again changes nothing';
  assert public.staff_set_item_image(tests.id('rice'), tests.id('rice') || '/r.webp') is null, 'rice photo added';
  assert public.staff_set_item_image(tests.id('rice'), null) = tests.id('rice') || '/r.webp',
    'removing a photo returns its path';
  assert (select image_path from public.inventory_items where id = tests.id('rice')) is null, 'rice photo cleared';
  assert (select image_path from public.inventory_items where id = tests.id('beans')) = tests.id('beans') || '/b.webp',
    'beans keeps the newer photo';
end $$;
delete from storage.objects where name = tests.id('beans') || '/a.webp';
reset role;
do $$ begin
  assert (select count(*) from storage.objects where name = tests.id('beans') || '/a.webp') = 0,
    'staff can delete replaced photos';
  assert (select string_agg(change, ', ' order by id) from public.audit_log
    where entity_id = tests.id('beans')::text and change like 'photo%') = 'photo added, photo changed',
    'photo changes are audited';
  assert (select change from public.audit_log where entity_id = tests.id('rice')::text
    order by id desc limit 1) = 'photo removed', 'photo removal is audited';
end $$;

-- Student profile photos (private bucket) ---------------------------------------------------
select tests.act_as(tests.id('one'));
set role authenticated;
insert into storage.objects(bucket_id, name) values
  ('student-photos', tests.id('one') || '/a.webp'),
  ('student-photos', tests.id('one') || '/b.webp');
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('student-photos', tests.id('two') || '/x.webp')$$, 'row-level security');
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('student-photos', tests.id('one') || '/../x.webp')$$, 'row-level security');
select tests.expect_error($$select public.set_my_profile_photo(tests.id('one') || '/missing.webp')$$,
  'did not finish uploading');
select tests.expect_error($$update public.profiles set photo_path = null where id = tests.id('one')$$,
  'permission denied');
do $$ begin
  assert public.set_my_profile_photo(tests.id('one') || '/a.webp') is null, 'first student photo has no previous file';
  assert public.set_my_profile_photo(tests.id('one') || '/b.webp') = tests.id('one') || '/a.webp',
    'replacing a student photo returns the old path to delete';
  assert public.set_my_profile_photo(tests.id('one') || '/b.webp') is null, 'setting the same photo changes nothing';
  assert (select photo_path from public.profiles where id = tests.id('one')) = tests.id('one') || '/b.webp',
    'students read their own photo path';
  assert (select count(*) from storage.objects where bucket_id = 'student-photos') = 2, 'students read their own files';
end $$;
delete from storage.objects where name = tests.id('one') || '/a.webp';
reset role;
insert into storage.objects(bucket_id, name) values ('student-photos', tests.id('two') || '/t.webp');
select tests.act_as(tests.id('two'));
set role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'student-photos') = 1,
    'students cannot read other students'' photo files';
  assert (select count(*) from public.profiles where photo_path is not null) = 0, 'students cannot read other profiles';
end $$;
select tests.expect_error($$select public.set_my_profile_photo(tests.id('one') || '/b.webp')$$, 'different account');
delete from storage.objects where name = tests.id('one') || '/b.webp';
reset role;
do $$ begin
  assert (select count(*) from storage.objects where name = tests.id('one') || '/a.webp') = 0,
    'students delete their replaced photo';
  assert (select count(*) from storage.objects where name = tests.id('one') || '/b.webp') = 1,
    'other students cannot delete it';
end $$;
select tests.act_as(tests.id('staff'));
set role authenticated;
do $$ begin
  assert (select photo_path from public.profiles where id = tests.id('one')) = tests.id('one') || '/b.webp',
    'staff see student photo paths';
  assert (select count(*) from storage.objects where bucket_id = 'student-photos') = 2, 'staff read student photo files';
end $$;
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('student-photos', tests.id('one') || '/s.webp')$$, 'row-level security');
delete from storage.objects where name = tests.id('one') || '/b.webp';
-- Staff set their own photo the same way.
insert into storage.objects(bucket_id, name) values ('student-photos', tests.id('staff') || '/me.webp');
select tests.expect_error($$select public.set_my_profile_photo(tests.id('one') || '/b.webp')$$, 'different account');
do $$ begin
  assert public.set_my_profile_photo(tests.id('staff') || '/me.webp') is null, 'staff add their own photo';
  assert (select photo_path from public.profiles where id = tests.id('staff')) = tests.id('staff') || '/me.webp',
    'staff photo saved';
end $$;
reset role;
do $$ begin
  assert (select count(*) from storage.objects where name = tests.id('one') || '/b.webp') = 1,
    'staff cannot delete student photos';
end $$;
select tests.act_as(tests.id('admin'));
set role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where name = tests.id('staff') || '/me.webp') = 1,
    'admins read staff photos';
end $$;
reset role;
select tests.act_as(tests.id('one'));
set role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'student-photos') = 1,
    'students cannot read staff photos';
  assert public.set_my_profile_photo(null) = tests.id('one') || '/b.webp', 'removing a photo returns its path';
  assert (select photo_path from public.profiles where id = tests.id('one')) is null, 'student photo cleared';
end $$;
reset role;
select tests.act_as(tests.id('staff'));
set role authenticated;

-- Pickup slots ----------------------------------------------------------------------------
do $$ begin
  assert (select count(*) from public.staff_create_pickup_slots(current_date + 2, '10:00', '11:00', 30, 1)) = 2,
    'two 30-minute slots created';
end $$;
select tests.expect_error($$select * from public.staff_create_pickup_slots(current_date + 2, '10:00', '11:00', 30, 1)$$,
  'already exist');
select tests.expect_error($$select * from public.staff_create_pickup_slots(current_date + 2, '11:00', '10:00', 30, 1)$$,
  'End time must be later');
select tests.remember('slotA', (select id from public.pickup_slots order by starts_at limit 1));
select tests.remember('slotB', (select id from public.pickup_slots order by starts_at offset 1 limit 1));
reset role;

-- Students request food -------------------------------------------------------------------
select tests.act_as(tests.id('one'));
set role authenticated;
select tests.expect_error($$select * from public.staff_create_pickup_slots(current_date + 3, '10:00', '11:00', 30, 1)$$,
  'Staff access required');
do $$ begin
  assert (select status from public.category_availability() where category = 'Canned goods') = 'in_stock',
    'category with enough usable stock is in stock';
  assert (select status from public.category_availability() where category = 'Personal care') = 'out_of_stock',
    'category with no usable stock is out of stock';
  assert (select status from public.category_availability() where category = 'Grains and pasta') = 'in_stock',
    'rice above its threshold';
  assert (select count(*) from public.pickup_slot_availability(current_date, current_date + 7)) = 2, 'students see slots';
  assert (select count(*) from public.available_inventory()) = 2, 'available food excludes items without stock';
  assert (select image_path from public.available_inventory() where item_id = tests.id('beans'))
    = tests.id('beans') || '/b.webp', 'students see item photos';
  assert (select count(*) from public.inventory_items) = 0, 'students cannot read inventory tables';
end $$;
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('item-images', tests.id('beans') || '/student.webp')$$, 'row-level security');
select tests.expect_error($$select public.staff_set_item_image(tests.id('beans'), null)$$, 'Staff access required');
delete from storage.objects where name = tests.id('beans') || '/b.webp';
reset role;
do $$ begin
  assert (select count(*) from storage.objects where name = tests.id('beans') || '/b.webp') = 1,
    'students cannot delete photos';
end $$;
select tests.act_as(tests.id('one'));
set role authenticated;
select tests.expect_error($$select public.submit_food_request(tests.id('slotA'), tests.id('soap'), '')$$,
  'no longer available');
select tests.remember('req1', (public.submit_food_request(tests.id('slotA'), tests.id('rice'), 'No pork')).id);
select tests.expect_error($$select public.submit_food_request(tests.id('slotB'), tests.id('rice'), '')$$,
  'already have an open request');
select tests.expect_error($$insert into public.food_requests(requested_categories, slot_id) values (array['x'], tests.id('slotB'))$$,
  'permission denied');
do $$ begin
  assert (select item_name from public.my_food_requests()) = 'Rice', 'student sees own request with item name';
  assert (select requested_categories from public.food_requests where id = tests.id('req1')) = array['Grains and pasta'],
    'category comes from the chosen item';
end $$;
reset role;

select tests.act_as(tests.id('two'));
set role authenticated;
select tests.expect_error($$select public.submit_food_request(tests.id('slotA'), tests.id('beans'), '')$$, 'full');
select tests.remember('req2', (public.submit_food_request(tests.id('slotB'), tests.id('beans'), '')).id);
do $$ begin
  assert (select count(*) from public.food_requests) = 1, 'students only read their own requests';
  assert (select count(*) from public.distributions) = 0, 'students cannot read distributions';
end $$;
select tests.expect_error($$select * from public.staff_list_requests()$$, 'Staff access required');
reset role;

-- Staff decide requests -------------------------------------------------------------------
select tests.act_as(tests.id('staff'));
set role authenticated;
do $$ begin
  assert (select count(*) from public.staff_list_requests()) = 2, 'staff see all requests';
  assert (select bool_and(first_visit) from public.staff_list_requests()), 'new students are first visits';
end $$;
select tests.expect_error($$select public.staff_decide_request(tests.id('req2'), false, '  ')$$, 'Enter a reason');
select public.staff_decide_request(tests.id('req2'), false, 'Closed for restocking');
select tests.expect_error($$select public.staff_decide_request(tests.id('req2'), true)$$, 'already declined');
select public.staff_decide_request(tests.id('req1'), true);
do $$ begin
  assert (select booked from public.pickup_slot_availability(current_date, current_date + 7) where id = tests.id('slotB')) = 0,
    'declining releases the slot';
  assert (select count(*) from public.staff_pickups(current_date + 2)) = 1, 'approved request appears in pickups';
  assert (select item_id from public.staff_pickups(current_date + 2) where request_id = tests.id('req1'))
    = tests.id('rice'), 'pickups include the requested food''s id';
end $$;
reset role;

select tests.act_as(tests.id('two'));
set role authenticated;
select tests.remember('req2b', (public.submit_food_request(tests.id('slotB'), tests.id('beans'), '')).id);
select public.cancel_food_request(tests.id('req2b'));
select tests.expect_error($$select public.cancel_food_request(tests.id('req2b'))$$, 'can no longer be cancelled');
select tests.expect_error($$select public.cancel_food_request(tests.id('req1'))$$, 'can no longer be cancelled');
reset role;

-- Distribution ----------------------------------------------------------------------------
select tests.act_as(tests.id('staff'));
set role authenticated;
select tests.expect_error($$select public.staff_complete_distribution(p_request_id => tests.id('req1'),
  p_items => jsonb_build_array(jsonb_build_object('item_id', tests.id('beans'), 'quantity', 6)))$$, 'Check the student ID card');
select tests.expect_error($$select public.staff_complete_distribution(p_request_id => tests.id('req1'),
  p_items => '[]'::jsonb, p_id_checked => true)$$, 'Add at least one item');
select tests.expect_error($$select public.staff_complete_distribution(p_request_id => tests.id('req1'),
  p_items => jsonb_build_array(jsonb_build_object('item_id', tests.id('beans'), 'quantity', 15)), p_id_checked => true)$$,
  'Only 14 of canned beans are available');
select tests.remember('dist1', (public.staff_complete_distribution(p_request_id => tests.id('req1'),
  p_items => jsonb_build_array(jsonb_build_object('item_id', tests.id('beans'), 'quantity', 5),
    jsonb_build_object('item_id', tests.id('beans'), 'quantity', 1),
    jsonb_build_object('item_id', tests.id('rice'), 'quantity', 1)), p_id_checked => true)).id);
do $$ begin
  assert (select qty_on_hand from public.inventory_lots where id = tests.id('beans_soon')) = 0, 'FEFO empties the soonest lot';
  assert (select qty_on_hand from public.inventory_lots where id = tests.id('beans_late')) = 8, 'FEFO takes the rest from the next lot';
  assert (select qty_on_hand from public.inventory_lots where id = tests.id('beans_expired')) = 7, 'expired lots are not handed out';
  assert (select status from public.food_requests where id = tests.id('req1')) = 'completed', 'request completed';
  assert (select sum(quantity) from public.distribution_lines where distribution_id = tests.id('dist1')) = 7, 'lines recorded';
  assert (select count(*) from public.stock_adjustments where kind = 'distribution') = 3, 'ledger rows per lot';
  assert (select student_id from public.profiles where id = tests.id('one')) = 'P00000001',
    'first-visit ID check verifies the claimed student ID';
  assert (select count(*) from public.student_id_audit where target_id = tests.id('one')) = 1, 'ID verification audited';
  assert jsonb_array_length((select items from public.staff_pickups(current_date + 2) limit 1)) = 2,
    'completed pickup lists items';
end $$;
select tests.expect_error($$select public.staff_complete_distribution(p_request_id => tests.id('req1'),
  p_items => jsonb_build_array(jsonb_build_object('item_id', tests.id('rice'), 'quantity', 1)), p_id_checked => true)$$,
  'already been completed');

-- Walk-ins --------------------------------------------------------------------------------
do $$ begin
  assert (select kind from public.staff_find_student('p00000099')) = 'account', 'finds accounts by claimed ID';
  assert not (select id_verified from public.staff_find_student('P00000099')), 'claimed ID shown as unverified';
  assert (select id_verified from public.staff_find_student('P00000001')), 'verified ID found';
  assert (select count(*) from public.staff_find_student('P12345678')) = 0, 'unknown ID returns nothing';
end $$;
select tests.expect_error($$select public.staff_create_provisional_student('P00000001', 'Someone', true)$$,
  'account already uses');
select tests.remember('walkin', (public.staff_create_provisional_student('p12345678', 'Wanda Walkin', true)).id);
select tests.expect_error($$select public.staff_create_provisional_student('P12345678', 'Dup', true)$$, 'already exists');
select tests.remember('dist2', (public.staff_complete_distribution(p_provisional_student_id => tests.id('walkin'),
  p_items => jsonb_build_array(jsonb_build_object('item_id', tests.id('beans'), 'quantity', 1)), p_id_checked => true)).id);
select tests.expect_error($$select public.staff_complete_distribution(p_profile_id => tests.id('two'),
  p_items => jsonb_build_array(jsonb_build_object('item_id', tests.id('beans'), 'quantity', 100)), p_id_checked => true)$$,
  'Only 7 of canned beans are available');
do $$ begin
  assert (select qty_on_hand from public.inventory_lots where id = tests.id('beans_late')) = 7, 'failed pickup changed nothing';
  assert (select provisional_student_id from public.distributions where id = tests.id('dist2')) = tests.id('walkin'),
    'walk-in recorded for the provisional student';
  assert (select count(*) from public.staff_list_students() where kind = 'provisional') = 1, 'provisional listed';
  assert (select count(*) from public.staff_pickups(current_date) where request_id is null) = 1, 'walk-in in today''s pickups';
end $$;
reset role;

-- A student registers with the walk-in's ID; verifying it links the walk-in history.
insert into auth.users(id, email, raw_user_meta_data) values
  (tests.id('four'), 'four@pvamu.edu', '{"display_name":"Wanda Walkin","student_id":"P12345678"}');
select tests.act_as(tests.id('staff'));
set role authenticated;
select public.staff_set_student_id(tests.id('four'), 'P12345678', true);
do $$ begin
  assert (select linked_profile_id from public.provisional_students where id = tests.id('walkin')) = tests.id('four'),
    'provisional profile linked';
  assert (select profile_id from public.distributions where id = tests.id('dist2')) = tests.id('four'),
    'walk-in history moved to the account';
  assert (select count(*) from public.staff_list_students() where kind = 'provisional') = 0, 'linked profile hidden';
end $$;

-- Donations -------------------------------------------------------------------------------
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church', 'church '],
  jsonb_build_array(jsonb_build_object('item_id', tests.id('rice'), 'quantity', 1, 'storage_location', 'B2')))$$,
  'only be added once');
select tests.expect_error($$select public.staff_record_donation(current_date + 5, array['Church'],
  jsonb_build_array(jsonb_build_object('item_id', tests.id('rice'), 'quantity', 1, 'storage_location', 'B2')))$$,
  'today or earlier');
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church'],
  jsonb_build_array(jsonb_build_object('item_id', tests.id('rice'), 'quantity', 0, 'storage_location', 'B2')))$$,
  'at least 1 for item 1');
select tests.remember('donation', (public.staff_record_donation(current_date, array['Northside Church', 'Alumni drive'],
  jsonb_build_array(
    jsonb_build_object('item_id', tests.id('beans'), 'quantity', 5, 'expiry_date', (current_date + 60)::text, 'storage_location', 'A4'),
    jsonb_build_object('item_id', tests.id('rice'), 'quantity', 2, 'storage_location', 'B2')))).id);
select public.staff_record_donation(current_date, array['northside church'],
  jsonb_build_array(jsonb_build_object('item_id', tests.id('rice'), 'quantity', 1, 'storage_location', 'B2')));
do $$ begin
  assert (select count(*) from public.donors) = 2, 'donors are reused case-insensitively';
  assert (select count(*) from public.inventory_lots where donation_id = tests.id('donation')) = 2, 'donation lines become lots';
  assert (select count(*) from public.stock_adjustments where kind = 'donation') = 3, 'donation ledger rows';
end $$;

-- A donation can add items that are not in the inventory yet.
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church'],
  jsonb_build_array(jsonb_build_object('new_item', jsonb_build_object('name', 'canned BEANS', 'category', 'Canned goods',
    'unit', 'can', 'low_stock_threshold', 5), 'quantity', 1, 'storage_location', 'A1-1')))$$,
  'already in the inventory');
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church'],
  jsonb_build_array(
    jsonb_build_object('new_item', jsonb_build_object('name', 'Lentils', 'category', 'Protein', 'unit', 'bag',
      'low_stock_threshold', 5), 'quantity', 1, 'storage_location', 'B1-1'),
    jsonb_build_object('new_item', jsonb_build_object('name', ' lentils', 'category', 'Protein', 'unit', 'bag',
      'low_stock_threshold', 5), 'quantity', 2, 'storage_location', 'B1-2')))$$,
  'Add each new item once');
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church'],
  jsonb_build_array(jsonb_build_object('new_item', jsonb_build_object('name', 'Lentils', 'category', ' ',
    'unit', 'bag', 'low_stock_threshold', 5), 'quantity', 1, 'storage_location', 'B1-1')))$$,
  'Choose a category for the new item in item 1');
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church'],
  jsonb_build_array(jsonb_build_object('new_item', jsonb_build_object('name', 'Lentils', 'category', 'Protein',
    'unit', 'bag', 'low_stock_threshold', -1), 'quantity', 1, 'storage_location', 'B1-1')))$$,
  'low-stock alert');
-- A bad later line also discards the new item created for an earlier line.
select tests.expect_error($$select public.staff_record_donation(current_date, array['Church'],
  jsonb_build_array(
    jsonb_build_object('new_item', jsonb_build_object('name', 'Lentils', 'category', 'Protein', 'unit', 'bag',
      'low_stock_threshold', 5), 'quantity', 1, 'storage_location', 'B1-1'),
    jsonb_build_object('item_id', tests.id('rice'), 'quantity', 0, 'storage_location', 'C1-1')))$$,
  'at least 1 for item 2');
do $$ begin
  assert (select count(*) from public.inventory_items where lower(name) = 'lentils') = 0, 'failed donation adds no items';
end $$;
select tests.remember('donation_new', (public.staff_record_donation(current_date, array['Food bank'],
  jsonb_build_array(
    jsonb_build_object('new_item', jsonb_build_object('name', ' Lentils ', 'category', 'Protein', 'unit', 'bag',
      'low_stock_threshold', 3), 'quantity', 4, 'expiry_date', (current_date + 90)::text, 'storage_location', 'B1-1'),
    jsonb_build_object('item_id', tests.id('rice'), 'quantity', 1, 'storage_location', 'C1-1')))).id);
do $$ begin
  assert (select count(*) from public.inventory_items where name = 'Lentils' and category = 'Protein' and unit = 'bag'
    and low_stock_threshold = 3 and active) = 1, 'new item created from the donation, name trimmed';
  assert (select l.qty_on_hand from public.inventory_lots l join public.inventory_items i on i.id = l.item_id
    where i.name = 'Lentils' and l.donation_id = tests.id('donation_new')) = 4, 'new item''s lot belongs to the donation';
  assert (select count(*) from public.inventory_lots where donation_id = tests.id('donation_new')) = 2, 'both lines recorded';
end $$;
reset role;
do $$ begin
  assert exists(select 1 from public.audit_log where action = 'Inventory item added' and record = 'Inventory · Lentils'
    and change = 'Added with a donation'), 'new item audited';
  assert exists(select 1 from public.audit_log where entity_id = tests.id('donation_new')::text
    and change = '2 lots added · 5 units'), 'donation audited';
  assert exists(select 1 from public.audit_log where action = 'Donation recorded' and change = '1 lot added · 1 unit'),
    'singular unit in the audit entry';
end $$;
select tests.act_as(tests.id('staff'));
set role authenticated;

-- Inventory edits and slots ------------------------------------------------------------------
select public.staff_update_inventory_item(tests.id('rice'), 'White rice', 'Grains and pasta', 'bag', 4);
select tests.expect_error($$select public.staff_set_lot_quantity(tests.id('beans_late'), 7, 'count')$$, 'different');
select tests.expect_error($$select public.staff_set_lot_quantity(tests.id('beans_late'), 6, ' ')$$, 'reason');
select public.staff_set_lot_quantity(tests.id('beans_late'), 6, 'Dented can');
select tests.expect_error($$select public.staff_update_pickup_slot(tests.id('slotA'), 0)$$, 'between 1 and 500');
select public.staff_update_pickup_slot(tests.id('slotB'), 3);
do $$ begin
  assert (select low_stock_threshold from public.inventory_items where id = tests.id('rice')) = 4, 'threshold updated';
  assert (select quantity_change from public.stock_adjustments where lot_id = tests.id('beans_late') and kind = 'adjustment') = -1,
    'counted quantity becomes a ledger adjustment';
end $$;
reset role;

-- No-show timing: a past slot can be marked; a future one cannot.
insert into public.pickup_slots(starts_at, ends_at, capacity) values (now() - interval '3 hours', now() - interval '150 minutes', 2);
insert into public.food_requests(student_id, requested_categories, slot_id, status)
  select tests.id('three'), array['Canned goods'], id, 'approved' from public.pickup_slots where starts_at < now();
select tests.remember('late', (select id from public.food_requests where student_id = tests.id('three')));
select tests.act_as(tests.id('three'));
set role authenticated;
select tests.expect_error($$select public.submit_food_request(tests.id('slotB'), tests.id('beans'), '')$$, 'open request');
reset role;
select tests.act_as(tests.id('staff'));
set role authenticated;
select public.staff_mark_no_show(tests.id('late'));
select tests.expect_error($$select public.staff_mark_no_show(tests.id('late'))$$, 'Only approved pickups');
reset role;

-- Admin: accounts, access, reports, audit --------------------------------------------------
select tests.act_as(tests.id('staff'));
set role authenticated;
select tests.expect_error($$select * from public.admin_list_accounts()$$, 'Administrator access required');
select tests.expect_error($$select * from public.admin_audit_entries()$$, 'Administrator access required');
select tests.expect_error($$select public.admin_monthly_report(current_date)$$, 'Administrator access required');
reset role;

select tests.act_as(tests.id('admin'));
set role authenticated;
select public.admin_set_access(tests.id('two'), 'student', false);
do $$
declare report jsonb := public.admin_monthly_report(current_date);
begin
  assert (select email from public.admin_list_accounts() where user_id = tests.id('one')) = 'one@pvamu.edu', 'admins see emails';
  assert (select count(*) from public.admin_report_months()) >= 1, 'report months listed';
  assert (report->>'completed')::int >= 1, 'report counts completed pickups';
  assert jsonb_array_length(report->'items') >= 1, 'report lists items handed out';
  assert (select count(distinct action) from public.admin_audit_entries() where action in (
    'Request approved', 'Request declined', 'Pickup completed', 'Walk-in pickup completed', 'Donation recorded',
    'Stock adjusted', 'Student ID verified', 'Provisional profile created', 'Provisional profile linked',
    'Pickup slots created', 'Pickup slot updated', 'Pickup marked no-show', 'Inventory item updated',
    'Inventory item added', 'Account deactivated')) = 15, 'audit covers every staff action';
end $$;
reset role;

-- Deactivated and anonymous users get nothing.
select tests.act_as(tests.id('two'));
set role authenticated;
select tests.expect_error($$select * from public.my_food_requests()$$, 'Active account required');
do $$ begin
  assert (select count(*) from public.pickup_slots) = 0, 'inactive accounts cannot read slots';
  assert (select count(*) from storage.objects where bucket_id = 'student-photos') = 0,
    'inactive students cannot read their photo files';
end $$;
select tests.expect_error($$select public.set_my_profile_photo(null)$$, 'Active account required');
reset role;
select tests.act_as(null);
set role anon;
select tests.expect_error($$select * from public.pickup_slots$$, 'permission denied');
select tests.expect_error($$select * from public.staff_list_requests()$$, 'permission denied');
select tests.expect_error($$select * from public.audit_log$$, 'permission denied');
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('item-images', tests.id('beans') || '/anon.webp')$$, 'row-level security');
select tests.expect_error($$select public.staff_set_item_image(tests.id('beans'), null)$$, 'permission denied');
select tests.expect_error($$insert into storage.objects(bucket_id, name)
  values ('student-photos', tests.id('one') || '/anon.webp')$$, 'row-level security');
select tests.expect_error($$select public.set_my_profile_photo(null)$$, 'permission denied');
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'student-photos') = 0,
    'anonymous visitors cannot read student photos';
end $$;
reset role;

\echo 'pantry_operations: all checks passed'
