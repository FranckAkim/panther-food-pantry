-- Minimal stand-in for the parts of Supabase the pantry migrations depend on:
-- API roles, auth.users, auth.uid(), Storage's bucket and object tables, and Supabase's
-- default privileges in public.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email varchar(255),
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz default now(),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Storage keeps file metadata in these tables (the files themselves live outside Postgres).
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Test helpers.
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Acts as a signed-in user; follow with `set role authenticated`.
create function tests.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
$$;

create function tests.id(p_name text) returns uuid language sql stable as $$
  select current_setting('tests.' || p_name)::uuid;
$$;

create function tests.remember(p_name text, p_value uuid) returns uuid language sql as $$
  select set_config('tests.' || p_name, p_value::text, false)::uuid;
$$;

-- Runs p_sql and requires an error whose message contains p_pattern (case-insensitive).
create function tests.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'Expected an error matching "%" from: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'Expected an error matching%' or sqlerrm not ilike '%' || p_pattern || '%' then
    raise;
  end if;
end;
$$;
grant execute on all functions in schema tests to anon, authenticated;
