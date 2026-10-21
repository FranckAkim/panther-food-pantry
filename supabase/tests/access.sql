-- Runs against the deployed schema. All fixtures and writes are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001','pantry-test-student@pvamu.edu','{"role":"admin"}'),
('00000000-0000-4000-8000-000000000002','pantry-test-other@pvamu.edu','{}'),
('00000000-0000-4000-8000-000000000003','pantry-test-admin@pvamu.edu','{}');
update private.user_access set role='admin' where user_id='00000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select role from public.my_access()) <> 'student' then raise exception 'Metadata escalated role'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Student can read other profiles'; end if;
  update public.profiles set display_name='Allowed profile edit' where id=auth.uid();
  begin
    update public.profiles set student_id='TEST-P00012345' where id=auth.uid();
    raise exception 'Student changed their student ID';
  exception when insufficient_privilege then null; end;
  begin
    perform public.staff_set_student_id(auth.uid(),'TEST-P00012345',true);
    raise exception 'Student assigned an ID through the staff operation';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.student_id_audit) <> 0 then raise exception 'Student read ID audit'; end if;
  begin
    perform public.admin_set_access('00000000-0000-4000-8000-000000000001','admin',true);
    raise exception 'Student promoted themselves';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_list_users(); raise exception 'Student listed users';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.food_requests(student_id,requested_categories)
      values('00000000-0000-4000-8000-000000000002',array['Produce']);
    raise exception 'Student forged ownership';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.food_requests(requested_categories,pickup_note) values(array['Produce'],'Afternoon pickup preferred');
do $$ begin
  begin
    insert into public.food_requests(requested_categories) values(array['   ']);
    raise exception 'Blank category accepted';
  exception when check_violation then null; end;
  begin
    insert into public.food_requests(requested_categories,pickup_note) values(array['Produce'],repeat('x',501));
    raise exception 'Long note accepted';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.food_requests) <> 0 then raise exception 'Other student read request'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select public.admin_set_access('00000000-0000-4000-8000-000000000002','staff',true);
do $$ begin
  if (select count(*) from public.admin_list_users() where user_id in
    ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003')) <> 3
    then raise exception 'Admin cannot list users'; end if;
  if (select count(*) from public.access_audit where actor_id=auth.uid()) <> 1 then raise exception 'Audit missing'; end if;
  begin
    -- Last-admin protection applies only when this is the sole enabled admin.
    -- Leave any existing real administrator untouched on a shared project.
    if (select count(*) from public.admin_list_users() where role='admin' and enabled) > 1 then return; end if;
    perform public.admin_set_access('00000000-0000-4000-8000-000000000003','student',true);
    raise exception 'Last admin removed';
  exception when check_violation then null; end;
end $$;
select public.staff_set_student_id('00000000-0000-4000-8000-000000000001','TEST-P00012345',true);
select public.staff_set_student_id('00000000-0000-4000-8000-000000000001','TEST-P99999999',true);
do $$ begin
  if (select count(*) from public.student_id_audit where target_id='00000000-0000-4000-8000-000000000001') <> 2
    then raise exception 'Admin ID changes not audited'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select role from public.my_access()) <> 'staff' then raise exception 'Staff role not visible'; end if;
  if (select count(*) from public.food_requests where student_id='00000000-0000-4000-8000-000000000001') <> 1 then raise exception 'Staff cannot read requests'; end if;
  begin
    insert into public.food_requests(requested_categories) values(array['Produce']);
    raise exception 'Staff submitted student request';
  exception when insufficient_privilege then null; end;
end $$;
select public.staff_set_student_id('00000000-0000-4000-8000-000000000001',' test-p00012346 ',true);
do $$ begin
  if (select student_id from public.profiles where id='00000000-0000-4000-8000-000000000001') <> 'TEST-P00012346'
    then raise exception 'Staff assignment failed'; end if;
  if not exists(select 1 from public.student_id_audit where actor_id=auth.uid()
    and target_id='00000000-0000-4000-8000-000000000001' and old_student_id='TEST-P99999999'
    and new_student_id='TEST-P00012346' and identification_checked and created_at is not null)
    then raise exception 'Staff ID audit incomplete'; end if;
  begin
    perform public.staff_set_student_id('00000000-0000-4000-8000-000000000003','TEST-P00012346',true);
    raise exception 'Duplicate ID allowed';
  exception when unique_violation then null; end;
  if (select student_id from public.profiles where id='00000000-0000-4000-8000-000000000003') is not null
    then raise exception 'Duplicate assignment was not atomic'; end if;
  if exists(select 1 from public.student_id_audit where target_id='00000000-0000-4000-8000-000000000003')
    then raise exception 'Rejected duplicate created an audit entry'; end if;
  if (select count(*) from public.student_id_audit where target_id='00000000-0000-4000-8000-000000000001') <> 3
    then raise exception 'Incorrect ID audit count'; end if;
  begin
    perform public.staff_set_student_id('00000000-0000-4000-8000-000000000001','TEST-UNVERIFIED',false);
    raise exception 'ID assigned without identification check';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.staff_set_student_id('00000000-0000-4000-8000-000000000001','',true);
    raise exception 'Blank ID accepted';
  exception when invalid_parameter_value then null; end;
  begin
    update public.student_id_audit set new_student_id='Tampered'; raise exception 'Audit edit allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select public.admin_set_access('00000000-0000-4000-8000-000000000002','staff',false);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin
    perform public.staff_set_student_id('00000000-0000-4000-8000-000000000001','TEST-DISABLED',true);
    raise exception 'Disabled staff assigned an ID';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select public.admin_set_access('00000000-0000-4000-8000-000000000001','student',false);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select enabled from public.my_access()) then raise exception 'Disabled user active'; end if;
  if (select count(*) from public.food_requests) <> 0 then raise exception 'Disabled session still reads'; end if;
  begin
    insert into public.food_requests(requested_categories) values(array['Produce']);
    raise exception 'Disabled user submitted request';
  exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.staff_set_student_id('00000000-0000-4000-8000-000000000001','TEST-FORGED',true);
    raise exception 'Anonymous ID assignment allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.profiles; raise exception 'Anonymous profile access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin
    insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000004','test@example.com');
    raise exception 'Non-university account accepted';
  exception when check_violation then null; end;
end $$;
rollback;
select 'Access tests passed; fixtures rolled back' as result;
