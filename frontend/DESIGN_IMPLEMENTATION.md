# Panther Pantry frontend

This frontend implements the available screens from [Food Panther in Figma](https://www.figma.com/design/lPAduCM2ltmkLaLk080yuh/Food-Panther?node-id=0-1) using React 18, Vite, and plain CSS, with HeroUI modals and React Hot Toast notifications. Data and accounts are stored in Supabase. The original development API proxy is retained. See [README.md](./README.md) for the modular code structure and development conventions.

## Run locally

From this `frontend` directory:

```sh
npm install
npm run dev
```

The development server uses port 5173. Vite proxies `/api` to `http://localhost:8000` by default; set `API_URL` to use a different backend address.

Build and preview the production bundle with:

```sh
npm run build
npm run preview
```

## Screen coverage

Navigation uses hash routes: for example, open `http://localhost:5173/#/staff/walk-in`. Student, staff, and admin portals have separate sign-in pages.

| Route                              | Screen and interactions                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `/sign-in`                         | Supabase sign-in with campus-email validation and password reset by email.                    |
| `/staff/sign-in`, `/admin/sign-in` | Staff and admin sign-in; each portal accepts only its own role.                               |
| `/register`                        | Student account form; shows a check-your-email step when confirmation is required.            |
| `/student/home`                    | Student welcome screen, availability, and the current request.                                |
| `/student/request`                 | Choose food, then a day and pickup time, add a dietary note, and submit a request.            |
| `/student/request-status`          | Current request status and cancellation.                                                      |
| `/student/history`                 | Current and past requests.                                                                    |
| `/staff/dashboard`                 | Summary counts, requests awaiting approval, and today's pickups.                              |
| `/staff/requests`                  | Search and filter requests; approve or decline with a required reason.                        |
| `/staff/request-detail`            | Inspect a selected request and its student details.                                           |
| `/staff/pickups`                   | Pickup list, date navigation, and pickup status actions.                                      |
| `/staff/distribution`              | Confirm identity, select food and quantities, remove items, and complete a pickup.            |
| `/staff/walk-in`                   | Search by student ID, create a provisional profile when needed, and continue to distribution. |
| `/staff/inventory`                 | Search and filter stock, inspect inventory (with item photos), and record changes.            |
| `/staff/item-detail`               | Stock lots, the stock ledger, adjustments, adding stock, and item editing.                    |
| `/staff/donations`                 | Record a donation (adding new items if needed) and inspect donation history.                  |
| `/staff/donations/new`             | Entry point for the donation form.                                                            |
| `/staff/students`                  | Student directory and profiles.                                                               |
| `/staff/student-profile`           | Student details, ID verification, and entry to the walk-in flow.                              |
| `/staff/slots`                     | Pickup slot management.                                                                       |
| `/admin/reports`                   | Monthly aggregate reports and CSV export.                                                     |
| `/admin/users`                     | Search/filter accounts, give staff access, change roles, and activate/deactivate accounts.    |
| `/admin/audit-log`                 | Search, filter, and paginate recorded staff/admin actions.                                    |

Admins also have the shared pantry workspace routes under `/admin/`; Users replaces Students in their navigation. Route configuration lives in `src/app/routes.js`, navigation/session behavior in `src/app/useAppNavigation.js`, and workspace dispatch in `src/app/WorkspaceContent.jsx`.

## Design implementation

Screens with retrieved Figma context use the supplied high fidelity layout, typography, color tokens, labels, and original SVG assets. Public Sans is bundled locally. The original Figma asset URLs are download sources only; runtime assets are local files.

The exported staff layout contained a collapsed sidebar approximately 24 pixels wide, which caused navigation and account text to overlap the main content. The implementation uses a 232 pixel desktop sidebar so the supplied navigation is usable. On smaller screens, the sidebar becomes a menu drawer and forms and cards adapt to the available width.

The Figma Starter plan MCP tool call limit prevented retrieval of high fidelity context for some screens. Student request status and history are functional extensions composed from the available shared design components; their layout is not claimed to match the inaccessible Figma screens exactly. Admin reports, users, and audit log screens were implemented from the screenshots supplied by the user.

## Data and integration

All records come from Supabase: accounts and roles, pickup slots, requests, inventory items and lots, the stock ledger, donations, walk-in (provisional) students, food handed out, reports, and the audit log. The schema, access rules, and business logic are in [`../supabase`](../supabase/README.md); the frontend's data layer is described in the [README](./README.md#how-the-app-talks-to-supabase).

- Dates and times display in pantry time (America/Chicago). Dashboards, pickups, and slot boards start from the real current date.
- Students register with their name, campus email, and student ID. The ID stays unverified until staff check the physical card, normally at the first pickup, where the ID-card checkbox is required.
- Walk-ins without an account get a provisional profile. When a student later registers with that student ID and staff verify it, the walk-in history moves to their account.
- Handing out food takes stock from the earliest-expiring usable lots and skips expired lots. Two staff cannot take the same stock at once.
- Admins give staff access to an existing account: the person signs up first, then an admin promotes them on the Users page. Creating accounts for others needs a server-side key, which the browser never has.
- Staff choose the shelf or bin from a fixed list (sections A–F, such as `A1-2`) when adding an item, adding stock, or recording a donation. The list lives in `src/features/stock/shelves.js`; change it only when the physical shelving changes.
- "Counted in" (the unit) is also a fixed dropdown, in **Add item**, **Edit item**, and for new items in a donation: cans, jars, bottles, cartons, boxes, bags, canisters, packs, bars, tubes, pouches, or each. Units are stored in the singular (`can`) and shown as `1 can` / `3 cans`. The list lives in `src/features/stock/units.js`; an item saved with a unit outside it keeps that unit as an option in **Edit item**.
- The starting inventory is classroom seed data from the database team. Its lots keep their original location codes (`DEMO-A1-1` and similar).

The Vite `/api` proxy is retained for the existing backend scaffold, including its health endpoint.

## Design asset checks

The walk-in module was bundled independently and checked in an isolated browser preview. The checked flow covers existing student search, an unknown student ID, required ID confirmation, provisional profile creation, distribution handoff, and completed pickup display. The warning icon was verified to load from its local original SVG at its native 20 × 20 pixel size. The sidebar assets were checked for nonempty files and native dimensions.

## Student request behavior

- The home banner always links to the same request flow as the header tab.
- Available food comes from `available_inventory()`: items with unexpired stock. It is shown as a grid of photo cards with category filters; Personal-care products are excluded. Items without a photo show a neutral package placeholder.
- The food cards are buttons with `aria-pressed` (like the day picker), not radios, so arrow keys do not change the choice. Choosing one collapses the grid to **Your food** with a **Change** button, which receives focus, and the day and time pickers follow directly below.
- Choosing food reveals the date and time controls for the next 30 days. Times and remaining capacity come from staff-managed pickup slots.
- Submit requires an available food and pickup slot. The server reserves the slot (refusing it when full) and records the chosen food; the student returns home to a **Request submitted** dialog.
- One open request is permitted at a time. Staff see the chosen food and can approve or decline the request. The hand-out list starts with the food the student requested (quantity 1, marked **Requested**); staff can change any quantity in the list, remove items, or add others. If the requested food is out of stock, the page says so and the list starts empty.
- Cancellation first opens a dialog. **Keep request**, Escape, and backdrop dismissal leave it unchanged. **Yes, cancel request** changes its status, releases reserved capacity, and removes the matching approved pickup. History retains the cancelled record.
- Changes made by staff appear for the student when they open another page or return to the tab.
- There is no decorative cursor or custom cursor asset in the frontend. The floating development preview control has been removed. Any browser automation cursor overlay is outside the React application.

## Donations with new items

- Each donation line's **Item** dropdown ends with **+ New item (not in inventory)**, in a separate "Not in the list" group (like the donor dropdown's **Other**). Choosing it shows the new item's name, category, unit ("Counted in"), and low-stock alert (default 10), then the usual quantity, expiry, and shelf, and an optional photo. Lines for existing items have no photo field.
- New items are created in the same database call as the donation (`staff_record_donation`), so a donation that fails leaves no stray items. A new item's name cannot match an item already in the inventory, and each new item appears once per donation; the form checks both before saving and the database checks again.
- A new item's photo uploads after the donation is saved (it needs the new item's id). If the upload fails, the donation and item are kept and staff are told which item's photo to add from **Edit item**.

## Profiles and photos

- The avatar in the student header opens **Your profile**, a drawer on the right (full screen on phones) with the student's name, email, student ID, whether staff have checked their ID card, an optional photo, and **Sign out**. Registration does not ask for a photo.
- Choosing a photo crops it to a 400 × 400 square in the browser and shows a preview; **Save photo** uploads it, **Cancel** discards it. **Change photo** and **Remove photo** follow once saved. The drawer explains that pantry staff see the photo to confirm who is picking up and other students never see it.
- Photos are private: files are served only through signed links that expire after an hour. A student can read and change only their own photo; staff and admins can read every student's photo but not change it.
- Staff and admins see the photo (or initials) beside the student's name in the dashboard's pickups, requests and request details, today's pickups, the student directory, and the admin Users list. Where staff confirm who is at the desk (handing out food, a walk-in match, and the student profile) a large photo is shown, captioned "From the student's profile", when the student has one.
- Staff and admins open the same **Your profile** drawer from their name in the sidebar (on phones the menu closes first). It shows their name, email, role, and an optional photo, which appears in the sidebar and beside their name in the admin Users list. Other staff and admins can see it; students can't. Sign out stays in the sidebar.
- After each step in the drawer (choosing, saving, cancelling, removing), focus moves to the next control so keyboard users stay in the drawer and Escape keeps working. The item photo field in **Add item** and **Edit item** keeps focus the same way.

## Item photos

- Each inventory item may have one photo. Students see it on the food cards in **Request food**; staff see a thumbnail in the inventory list, a larger one beside the item name on its page, thumbnails on the hand-out-food list, and thumbnails in a donation's details.
- Staff add, change, or remove a photo in **Add item** or **Edit item**. A donation never changes an existing item's photo; a new item added with a donation can take an optional photo (see below). The browser crops the chosen image to 4:3 around its center and scales it to 800 × 600 WebP (JPEG where the browser cannot encode WebP), so uploads stay around 100 KB and every card matches. The preview in the dialog is the cropped result.
- Photos are decorative next to the item name (`alt=""`). Missing or broken photos fall back to a package placeholder.
- The starting photos for the existing items are CC0 or public-domain stock photos; sources are listed in `../supabase/item-photo-credits.md`.

## Verification

The SQL test suite (`supabase/tests/run-local.sh`) applies every migration to a temporary Postgres database and checks the workflows and access rules for students, staff, admins, deactivated accounts, and anonymous visitors.

An end-to-end browser run against the live Supabase project, using the demo accounts, covered: staff sign-in and dashboard; creating pickup slots; student availability, food and slot selection, and submission; approval from the staff queue; the student seeing the confirmed pickup; handing out food with the first-visit ID check; a walk-in with a new provisional profile; recording a donation; the item's lots and stock ledger; the student directory; admin reports, audit log, and users; the student's history; and sign-out redirects. No console errors or failed Supabase requests occurred. Test records were removed afterward.

Earlier checks of the mock-data version covered both cancellation choices and a 390px mobile layout without horizontal page overflow.
