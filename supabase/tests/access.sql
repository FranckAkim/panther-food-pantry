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
  if (select count(*) from public.admin_list_users()) <> 3 then raise exception 'Admin cannot list users'; end if;
  if (select count(*) from public.access_audit) <> 1 then raise exception 'Audit missing'; end if;
  begin
    perform public.admin_set_access('00000000-0000-4000-8000-000000000003','student',true);
    raise exception 'Last admin removed';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select role from public.my_access()) <> 'staff' then raise exception 'Staff role not visible'; end if;
  if (select count(*) from public.food_requests) <> 1 then raise exception 'Staff cannot read requests'; end if;
  begin
    insert into public.food_requests(requested_categories) values(array['Produce']);
    raise exception 'Staff submitted student request';
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
