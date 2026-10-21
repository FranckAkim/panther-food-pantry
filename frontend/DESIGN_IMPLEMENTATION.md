# Panther Pantry frontend

This frontend implements the available screens from [Food Panther in Figma](https://www.figma.com/design/lPAduCM2ltmkLaLk080yuh/Food-Panther?node-id=0-1) using React 18, Vite, and plain CSS, with HeroUI modals and React Hot Toast notifications. The original development API proxy is retained. See [README.md](./README.md) for the modular code structure and development conventions.

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
| `/sign-in`                         | Sign-in form with campus-email validation and a local demo session.                           |
| `/staff/sign-in`, `/admin/sign-in` | Staff and admin sign-in forms with sample accounts.                                           |
| `/register`                        | Account form with name, student ID, campus-email, and password-length validation.             |
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
| `/staff/inventory`                 | Search and filter stock, inspect inventory, and record changes.                               |
| `/staff/item-detail`               | Stock lots, adjustments, and item editing.                                                    |
| `/staff/donations`                 | Record a donation and inspect donation history.                                               |
| `/staff/donations/new`             | Entry point for the donation form.                                                            |
| `/staff/students`                  | Student directory and profiles.                                                               |
| `/staff/student-profile`           | Student details, ID verification, and entry to the walk-in flow.                              |
| `/staff/slots`                     | Pickup slot management.                                                                       |
| `/admin/reports`                   | Monthly aggregate reports and CSV export.                                                     |
| `/admin/users`                     | Search/filter accounts, add staff, change roles, and activate/deactivate accounts.            |
| `/admin/audit-log`                 | Search, filter, and paginate recorded staff/admin actions.                                    |

Admins also have the shared pantry workspace routes under `/admin/`; Users replaces Students in their navigation. Route configuration lives in `src/app/routes.js`, navigation/session behavior in `src/app/useAppNavigation.js`, and workspace dispatch in `src/app/WorkspaceContent.jsx`.

## Design implementation

Screens with retrieved Figma context use the supplied high fidelity layout, typography, color tokens, labels, and original SVG assets. Public Sans is bundled locally. The original Figma asset URLs are download sources only; runtime assets are local files.

The exported staff layout contained a collapsed sidebar approximately 24 pixels wide, which caused navigation and account text to overlap the main content. The implementation uses a 232 pixel desktop sidebar so the supplied navigation is usable. On smaller screens, the sidebar becomes a menu drawer and forms and cards adapt to the available width.

The Figma Starter plan MCP tool call limit prevented retrieval of high fidelity context for some screens. Student request status and history are functional extensions composed from the available shared design components; their layout is not claimed to match the inaccessible Figma screens exactly. Admin reports, users, and audit log screens were implemented from the screenshots supplied by the user.

## Demo behavior and integration boundaries

The frontend supports local demonstration flows. Demo identity, requests, pickups, inventory, and other editable records use browser state or local storage. Changes persist in that browser and do not create real accounts or modify a server database. Mock registration stores a password digest rather than the entered password. The password-reset dialog describes the pending backend connection.

The Vite `/api` proxy is retained for the existing backend scaffold, including its health endpoint. Feature endpoints for authentication, requests, inventory, donations, student records, and reporting are not connected. Production authentication, authorization, validation, transactional stock changes, and student identity checks need a backend implementation before real use.

Example names, student IDs, counts, and dates originate from the design and demo data. Displayed design dates are fixtures rather than a live pantry schedule. Report totals and account permissions should not be treated as real operational data.

Walk-in profile creation verifies the entered student ID format, requires the ID-card checkbox, avoids duplicate provisional IDs, and carries the selected student into the food distribution flow. The checkbox records a staff interaction in the demo; it does not independently verify enrollment.

Clear the demo's browser data when a fresh fixture state is needed.

## Verification

The walk-in module was bundled independently and checked in an isolated browser preview. The checked flow covers existing student search, an unknown student ID, required ID confirmation, provisional profile creation, distribution handoff, and completed pickup display. The warning icon was verified to load from its local original SVG at its native 20 × 20 pixel size. The sidebar assets were checked for nonempty files and native dimensions.

## Student request behavior

- The home banner always links to the same request flow as the header tab.
- Available food comes from the shared mock inventory; out-of-stock items and personal-care products are excluded from the food dropdown.
- Choosing food reveals the date and time controls. Times and remaining capacity come from the staff-managed mock slots.
- Submit requires an available food and pickup slot, reserves one slot, persists the selected food, and returns home with a **Request submitted** dialog.
- One open request is permitted at a time. Staff see the chosen food and can approve or decline the request. The distribution form starts empty; staff choose the items and quantities being handed out.
- Cancellation first opens a dialog. **Keep request**, Escape, and backdrop dismissal leave it unchanged. **Yes, cancel request** changes its status, releases reserved capacity, and removes the matching approved pickup. History retains the cancelled record.
- Mock data changes are shared among roles in the same browser origin. `localhost` and `127.0.0.1` have separate local storage.
- There is no decorative cursor or custom cursor asset in the frontend. The floating development preview control has been removed. Any browser automation cursor overlay is outside the React application.

## Verification

Production build and browser checks cover all three sign-ins, food-first selection, disabled submission before a slot is chosen, submission dialog, both cancellation choices, approval from the staff queue, released capacity, and a 390px mobile layout without horizontal page overflow.
