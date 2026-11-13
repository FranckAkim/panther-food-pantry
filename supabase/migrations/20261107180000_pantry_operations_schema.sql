-- Pantry operations: pickup slots, the request workflow, walk-in students, donations,
-- distribution (food handed out), and a general audit log.
-- Follows the earlier migrations: RLS on every table, clients read through policies,
-- and every write goes through private security-definer functions (next migration).

-- Audit log for staff/admin actions not already recorded by access_audit,
-- student_id_audit, or stock_adjustments.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity text not null check (char_length(entity) between 1 and 40),
  entity_id text,
  record text not null default '' check (char_length(record) <= 300),
  change text not null default '' check (char_length(change) <= 500),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log(created_at desc);
create index audit_log_actor_idx on public.audit_log(actor_id);

-- Student ID typed at registration. Unverified until staff check the physical card,
-- which copies it to profiles.student_id through private.set_student_id.
alter table public.profiles add column claimed_student_id text
  check (claimed_student_id is null or char_length(claimed_student_id) between 1 and 30);
create index profiles_claimed_student_id_idx on public.profiles(claimed_student_id);

-- Students served without an account (walk-ins). Linked to an account once that
-- account's student ID is verified with the same number.
create table public.provisional_students (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique check (char_length(student_id) between 1 and 30),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 100),
  id_checked_at timestamptz,
  id_checked_by uuid references public.profiles(id) on delete set null,
  linked_profile_id uuid unique references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.pickup_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 500),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- A request always reserves a pickup slot; staff approval confirms it.
-- requested_categories stays (filled from the chosen item's category).
alter table public.food_requests
  add column slot_id uuid not null references public.pickup_slots(id),
  add column requested_item_id uuid references public.inventory_items(id),
  add column decline_reason text
    check (decline_reason is null or char_length(btrim(decline_reason)) between 1 and 500),
  add column decided_by uuid references public.profiles(id) on delete set null,
  add column decided_at timestamptz,
  add column updated_at timestamptz not null default now();
alter table public.food_requests drop constraint food_requests_status_check;
alter table public.food_requests add constraint food_requests_status_check
  check (status in ('submitted','approved','declined','completed','cancelled','no_show'));
create unique index food_requests_one_open_per_student on public.food_requests(student_id)
  where status in ('submitted','approved');
create index food_requests_slot_idx on public.food_requests(slot_id);
create index food_requests_requested_item_idx on public.food_requests(requested_item_id);
create index food_requests_status_created_idx on public.food_requests(status, created_at desc);

alter table public.inventory_items add column low_stock_threshold integer not null default 10
  check (low_stock_threshold between 0 and 100000);

create table public.donors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create unique index donors_name_key on public.donors(lower(btrim(name)));

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  received_on date not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index donations_received_idx on public.donations(received_on desc);
create index donations_recorded_by_idx on public.donations(recorded_by);

create table public.donation_donors (
  donation_id uuid not null references public.donations(id) on delete cascade,
  donor_id uuid not null references public.donors(id),
  primary key (donation_id, donor_id)
);
create index donation_donors_donor_idx on public.donation_donors(donor_id);

-- Each donation line becomes a lot; received_quantity keeps the original amount.
alter table public.inventory_lots
  add column donation_id uuid references public.donations(id),
  add column received_quantity integer check (received_quantity is null or received_quantity >= 0);
create index inventory_lots_donation_idx on public.inventory_lots(donation_id);

alter table public.stock_adjustments add column kind text not null default 'adjustment'
  check (kind in ('initial','adjustment','donation','distribution'));
update public.stock_adjustments set kind = 'initial'
  where reason = 'Initial stock' or reason like 'DEMO seed:%';
update public.inventory_lots l set received_quantity = a.quantity_change
  from (select distinct on (lot_id) lot_id, quantity_change from public.stock_adjustments
        where kind = 'initial' order by lot_id, id) a
  where a.lot_id = l.id;

-- Food handed out: one row per pickup (approved request or walk-in), lines per lot (FEFO).
create table public.distributions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.food_requests(id),
  profile_id uuid references public.profiles(id),
  provisional_student_id uuid references public.provisional_students(id),
  staff_id uuid references public.profiles(id) on delete set null,
  id_checked boolean not null default false,
  distributed_at timestamptz not null default now(),
  check (profile_id is not null or provisional_student_id is not null)
);
create index distributions_profile_idx on public.distributions(profile_id);
create index distributions_provisional_idx on public.distributions(provisional_student_id);
create index distributions_staff_idx on public.distributions(staff_id);
create index distributions_distributed_idx on public.distributions(distributed_at desc);

create table public.distribution_lines (
  id bigint generated always as identity primary key,
  distribution_id uuid not null references public.distributions(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  lot_id uuid not null references public.inventory_lots(id),
  quantity integer not null check (quantity > 0)
);
create index distribution_lines_distribution_idx on public.distribution_lines(distribution_id);
create index distribution_lines_item_idx on public.distribution_lines(item_id);
create index distribution_lines_lot_idx on public.distribution_lines(lot_id);

-- Row-level security: staff/admin read operational tables; any active account reads
-- slot times; only admins read the audit log. No client writes: functions do them.
alter table public.audit_log enable row level security;
alter table public.provisional_students enable row level security;
alter table public.pickup_slots enable row level security;
alter table public.donors enable row level security;
alter table public.donations enable row level security;
alter table public.donation_donors enable row level security;
alter table public.distributions enable row level security;
alter table public.distribution_lines enable row level security;

create policy audit_log_read on public.audit_log for select to authenticated
using ((select private.current_role()) = 'admin');
create policy provisional_students_read on public.provisional_students for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy pickup_slots_read on public.pickup_slots for select to authenticated
using ((select private.current_role()) is not null);
create policy donors_read on public.donors for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy donations_read on public.donations for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy donation_donors_read on public.donation_donors for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy distributions_read on public.distributions for select to authenticated
using ((select private.current_role()) in ('staff','admin'));
create policy distribution_lines_read on public.distribution_lines for select to authenticated
using ((select private.current_role()) in ('staff','admin'));

revoke all on public.audit_log, public.provisional_students, public.pickup_slots, public.donors,
  public.donations, public.donation_donors, public.distributions, public.distribution_lines
  from public, anon, authenticated;
grant select on public.audit_log, public.provisional_students, public.pickup_slots, public.donors,
  public.donations, public.donation_donors, public.distributions, public.distribution_lines
  to authenticated;
revoke all on sequence public.audit_log_id_seq, public.distribution_lines_id_seq
  from public, anon, authenticated;

-- Requests are submitted through submit_food_request() so slot capacity is enforced.
drop policy request_submit on public.food_requests;
revoke insert on public.food_requests from authenticated;
revoke insert(requested_categories, pickup_note) on public.food_requests from authenticated;

-- Staff edit the low-stock threshold alongside the existing item columns.
grant insert(low_stock_threshold), update(low_stock_threshold) on public.inventory_items to authenticated;
