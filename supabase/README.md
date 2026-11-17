# Panther Pantry database (Supabase)

Postgres schema, access rules, and business logic for the pantry, applied to the project's Supabase database. The frontend calls these through the Supabase Data API; see [`frontend/README.md`](../frontend/README.md).

## Migrations

`migrations/` holds every change in the order applied. Each file is recorded in the database's `supabase_migrations.schema_migrations` table under the same version.

| Version          | What it adds                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261013070247` | Profiles, roles (`private.user_access`), `@pvamu.edu` sign-up rule, food requests, admin role changes with an audit table                                                                                  |
| `20261013071016` | Request category validation                                                                                                                                                                                |
| `20261013155254` | Inventory items, lots, the stock ledger (`stock_adjustments`), and student-facing availability                                                                                                             |
| `20261019162754` | Student IDs assigned only by staff after a physical ID check                                                                                                                                               |
| `20261107180000` | Pickup slots, request workflow columns (slot, item, decision, no-show), walk-in (provisional) students, donors and donations, food handed out (`distributions`, `distribution_lines`), general `audit_log` |
| `20261107180100` | The functions behind every staff, student, and admin action (listed below)                                                                                                                                 |
| `20261107190000` | Category availability for the student home page                                                                                                                                                            |
| `20261107224026` | Removes the "[DEMO]" prefix from the sample inventory item names (data only)                                                                                                                               |
| `20261107224900` | Optional item photos: `inventory_items.image_path`, the public `item-images` Storage bucket with staff-only upload and delete, `staff_set_item_image()`, and photos in `available_inventory()`             |
| `20261109065001` | `staff_pickups()` also returns the requested food's id (`item_id`), so the hand-out list can start with it                                                                                                 |
| `20261109065726` | Staff and admins can set a profile photo too: any active account manages its own folder in `student-photos`; students still read only their own                                                            |
| `20261109062956` | Optional student profile photos: `profiles.photo_path`, the private `student-photos` Storage bucket (students manage their own folder; staff and admins read), and `set_my_profile_photo()`                |
| `20261109060207` | `staff_record_donation()` can add items not yet in the inventory (`new_item` lines), created in the same transaction as the donation                                                                       |

The first four come from the database team's history; the rest build on them with the same conventions.

## Conventions

- **Row-level security on every table.** Policies call `private.current_role()`. Students read only their own requests; staff and admins read operational tables; only admins read the audit log. Anonymous visitors get nothing.
- **Writes go through functions.** Clients have no insert, update, or delete rights on the new tables. Each action is a `private.*` `security definer` function that checks the caller's role and validates input, with a thin `public.*` `security invoker` wrapper that the Data API exposes.
- **Revoke defaults.** Supabase grants `anon` and `authenticated` full access to new public tables and functions by default. Every migration revokes that and grants only what is needed.
- **Messages for people.** Functions raise errors worded for the screen (for example, "This pickup time is full. Choose another time."), with standard error codes (`42501` access, `22023` invalid input, `23505` duplicate, `23514` limit, `P0002` not found).
- **Pantry time.** Dates use America/Chicago (`private.pantry_today()`).
- **Files in Storage.** Item photos live in the public `item-images` bucket as `<item id>/<file>` (images only, 2 MB limit). Anyone with a link can view a photo; Storage policies let only staff and admins upload into an existing item's folder or delete files. Profile photos are personal, so they live in the private `student-photos` bucket (named before staff photos were added) as `<profile id>/<file>` and are shown through signed links that expire after an hour: every active account can upload, read, and delete only in its own folder, staff and admins can read all of them, and students never see anyone else's. Never delete Storage files with SQL (`delete from storage.objects` leaves the file behind); the app removes replaced photos through the Storage API.

## Functions the app calls

| Area      | Functions                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account   | `my_access`, `admin_list_accounts`, `admin_set_access`, `set_my_profile_photo`                                                                                                            |
| Students  | `available_inventory`, `category_availability`, `pickup_slot_availability`, `submit_food_request`, `cancel_food_request`, `my_food_requests`                                              |
| Requests  | `staff_list_requests`, `staff_decide_request`, `staff_mark_no_show`, `staff_pickups`, `staff_complete_distribution`                                                                       |
| Walk-ins  | `staff_find_student`, `staff_create_provisional_student`, `staff_check_provisional_id`, `staff_set_student_id`, `staff_list_students`                                                     |
| Inventory | `staff_create_inventory_item`, `staff_update_inventory_item`, `staff_set_item_image`, `staff_set_lot_quantity`, `create_inventory_lot`, `adjust_inventory_stock`, `staff_record_donation` |
| Slots     | `staff_create_pickup_slots`, `staff_update_pickup_slot`                                                                                                                                   |
| Admin     | `admin_monthly_report`, `admin_report_months`, `admin_audit_entries`                                                                                                                      |

Key rules enforced in the database:

- One open request per student; a slot cannot be booked past its capacity (the slot row is locked during booking).
- Declining needs a reason; a no-show can be recorded 30 minutes after the slot ends.
- Handing out food takes stock from the earliest-expiring usable lots, skips expired lots, locks the lots it uses, and records every lot change in the ledger. A student's first pickup requires the ID-card check, which also verifies the student ID they registered with.
- Verifying an account's student ID links any walk-in history recorded under that ID.
- A donation line names an existing item (`item_id`) or a new one (`new_item`: name, category, unit, low-stock alert). New items are created with the donation in one transaction; a new item's name must not match an active item, and each appears once per donation.

## Tests

```sh
supabase/tests/run-local.sh
```

Needs Postgres 15+ (`initdb`, `pg_ctl`, `psql` on `PATH`). The script creates a temporary database, adds a minimal stand-in for Supabase's auth schema, Storage tables, and default privileges (`tests/supabase_shim.sql`), applies every migration, and runs `tests/*.test.sql` as students, staff, admins, a deactivated account, and an anonymous visitor. Nothing touches the live project.

## Applying a new migration

1. Add `migrations/<UTC timestamp>_<name>.sql` and tests in `tests/`, then run `supabase/tests/run-local.sh`.
2. Apply it to the project, recording it in the migration history. With the Supabase CLI: `supabase db push --db-url "$SUPABASE_DB_URL"`. With `psql`, run the file in one transaction and insert its version, name, and SQL into `supabase_migrations.schema_migrations`, as the existing rows do.

`SUPABASE_DB_URL` is the Session pooler connection string from the dashboard's **Connect** dialog. Keep it in a Git-ignored file such as `frontend/.env.db`; it grants full database access.
