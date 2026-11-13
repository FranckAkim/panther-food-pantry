# Panther Pantry frontend

React 18 and Vite frontend with student, staff, and admin portals. Accounts, requests, pickup slots, inventory, donations, walk-ins, reports, and the audit log are stored in Supabase. The database schema, access rules, and business logic live in [`../supabase`](../supabase/README.md).

## Development

```sh
npm install
cp .env.example .env # Fresh checkouts only; keep any existing configuration
npm run dev
```

Vite serves the app on port 5173. Navigation uses hash routes, such as `/#/admin/reports`. The existing `/api` proxy points to `http://localhost:8000`; `API_URL` can override that address.

```sh
npm test             # Mapping, date, and admin-rule tests (no network)
npm run build        # Production build
npm run preview      # Preview the production build
npm run format       # Format source, tests, configuration, and documentation
npm run format:check
```

### Demo accounts

The Supabase project has one demo account per role: `demo.student@pvamu.edu`, `demo.staff@pvamu.edu`, and `demo.admin@pvamu.edu`. Their shared password goes in `frontend/.env.development.local` as `VITE_DEMO_PASSWORD`. Vite loads that file only for `npm run dev`, never for production builds, and Git ignores it. When it is present, each sign-in page offers a **Use demo account** button. Ask a teammate for the password; do not commit it.

## Supabase connection

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `frontend/.env` (Git ignores it; `.env.example` lists the variables). Set the same variables in the deployment build environment and restart Vite after changing them. Only a publishable key belongs in the browser; the configuration rejects secret keys.

```sh
npm run supabase:check                # Auth endpoint reachable, key accepted
npm run supabase:check -- TABLE_NAME  # Also query a table (anonymous users are refused: expected)
```

In **Authentication → URL Configuration**, add each address the app runs on to **Redirect URLs** (for example `http://localhost:5173/**`), so password-reset and confirmation links return to the app. The app always names its own address as the redirect; Supabase falls back to the **Site URL** only when that address is not in the list, so set the Site URL to the main address (the deployed one, once it exists).

### How the app talks to Supabase

- **Auth.** Supabase Auth owns passwords and sessions (`src/api/auth.js`, `features/auth/useSession.js`). After sign-in, the app reads the account's role with `my_access()`. Each portal accepts only its own role; inactive accounts are signed out.
- **Reads.** Staff screens read tables directly where row-level security allows it (inventory, donations). Everything that joins people, slots, and stock goes through database functions such as `staff_list_requests()` and `staff_pickups(date)`.
- **Item photos.** Photos are files in the public `item-images` Storage bucket; items store the file path (`image_path`). `src/api/itemPhotos.js` uploads a photo prepared in the browser (`src/lib/photos.js` crops it to 4:3 and scales it to 800 × 600 WebP), switches the item to it with `staff_set_item_image()`, and deletes the file it replaced. `components/ui/ItemPhoto.jsx` shows a photo or a placeholder.
- **Profile photos.** Optional for every account, set in the **Your profile** drawer (`components/ProfileDrawer.jsx`, opened from the student header or the staff/admin sidebar). Files are in the private `student-photos` bucket (named before staff photos were added) and `profiles.photo_path` holds the path. `src/api/profilePhotos.js` uploads a square photo, switches to it with `set_my_profile_photo()`, and makes signed links (valid for an hour); staff screens load every account's link in one request (`hooks/useProfilePhotos.js`) and show it with `components/AccountAvatar.jsx`.
- **Writes.** Every change calls a database function (`submit_food_request`, `staff_complete_distribution`, `staff_record_donation`, …). The functions enforce roles, capacity, stock, and the first-visit ID check, and record the audit log, so the rules hold even for requests that bypass the UI.
- **Caching.** TanStack Query caches results under the keys in `src/api/keys.js`. After a change, `useRefresh()` refetches the affected keys (`affected.*`), and every navigation refetches what is on screen.
- **Errors.** Database functions raise messages written for users; `src/api/errors.js` passes those through and replaces network, session, and internal errors with plain wording.

## Code organization

```text
src/
  main.jsx                    Mount React and the app providers
  api/                        Supabase access, independent of React
    client.js                 rpc() and run() helpers that throw user-facing errors
    errors.js                 Error-message mapping
    auth.js                   Sign-in, registration, password reset, current account
    requests.js               Student requests, staff decisions, pickups, distribution
    inventory.js              Items, lots, stock ledger, availability
    operations.js             Slots, students and walk-ins, donations, admin data
    itemPhotos.js             Item photo links, uploads, and removal (Supabase Storage)
    profilePhotos.js          Profile photo signed links, uploads, and removal (private bucket)
    mappers.js                Database rows → the shapes the screens use
    time.js                   Pantry-time (America/Chicago) dates and labels
    keys.js                   Query cache keys and what each change affects
  app/
    App.jsx                   Choose loading, authentication, student, or workspace views
    AppProviders.jsx          Query client, HeroUI, toast, and pending-action providers
    routes.js                 Navigation links, page groups, and titles
    useAppNavigation.js       Hash navigation, session, redirects, and sign-out
    WorkspaceLayout.jsx       Staff/admin sidebar and responsive layout
    WorkspaceContent.jsx      Select the workspace feature
  components/
    ui/                       Shared Button, Field, Card, Modal, Drawer, Avatar, ItemPhoto, and other controls
    AccountAvatar.jsx         An account's photo or initials on staff screens; large photo for identity checks
    ProfileDrawer.jsx         "Your profile" drawer with the optional photo (students, staff, admins)
    loading/                  DataLoader (loading/error/retry) and pending actions
    Notifications.jsx         Top-center toast provider and helpers
  features/
    auth/                     Sign-in, registration, password reset, session hook
    student/                  Student pages, request state, and dialogs
    operations/               Dashboard, requests, pickups, and handing out food
    stock/                    Inventory, donations, students, and pickup slots
    walk-in/                  Student lookup and provisional-profile flow
    admin/                    Reports (CSV export), users and access, audit log
  hooks/
    useSessionState.js        Per-tab screen state (selected record, chosen day)
    useProfilePhotos.js       Cached photo links (staff and admins) and the signed-in account's own photo
  lib/
    supabase/                 Browser client and environment validation
    queryClient.js            TanStack Query client and useRefresh()
    photos.js                 Crop and resize a chosen photo before upload (4:3 items, square students)
    dates.js                  Shared admin date formatting
tests/
  mappers.test.js             Row mapping, pantry time, units, error messages
  admin.test.js               Access-change rules, staff access, CSV export
  supabase.test.js            Supabase environment validation
```

Within larger features:

- **Pages** compose the screen and receive the data and callbacks they need.
- **Components** contain reusable sections or dialogs within that feature.
- **Hooks** own related queries, state, validation, and actions.
- **Models/utilities** contain calculations that can be tested without rendering React.
- **Feature CSS** stays beside its feature. `app/App.jsx` imports it in an explicit order to preserve the existing cascade.

## Following a flow

For a staff request, start at `app/WorkspaceContent.jsx`, then `features/operations/OperationsPages.jsx`. Its `useOperations` hook loads requests, pickups, and stock, and calls `api/requests.js` to approve, decline, mark no-shows, and complete pickups. Lot selection (earliest expiry first) happens in the database function `staff_complete_distribution`.

For a donation, start at `features/stock/pages/Donations.jsx`. `hooks/useDonationForm.js` owns the donor/item draft and calls `recordDonation()`, which creates the donors, any new items, lots, and ledger entries in one database call. Photos for new items upload afterwards.

For reports, users, or the audit log, see `features/admin/`. Totals and audit entries come from `admin_monthly_report()` and `admin_audit_entries()`.

## Boundaries to preserve

- Keep business rules in the database functions (`../supabase/migrations`), with UI checks only for quicker feedback. Never rely on the UI alone for a rule.
- Add new data access to `src/api/` with a mapper, not inside components. Add a cache key to `keys.js` and list it in `affected` for each change that alters it.
- Use `DataLoader` with the page's queries for loading and error states, and the shared `Modal`, `Button`, and `AsyncForm` for actions so pending states and error toasts stay consistent.
- Use `useSessionState` only for screen state. Pantry records always come from Supabase.
- Display dates and times with `api/time.js` so every viewer sees pantry (Central) time.

See [DESIGN_IMPLEMENTATION.md](./DESIGN_IMPLEMENTATION.md) for screen coverage and design context.
