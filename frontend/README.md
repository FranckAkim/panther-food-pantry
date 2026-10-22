# Panther Pantry frontend

React 18 and Vite frontend with student, staff, and admin portals. The screens use mock data and browser storage. Supabase backend helpers are available in `src/lib/`, but the screens do not call them yet.

## Development

```sh
npm ci
npm run dev
```

Vite serves the app on port 5173. Navigation uses hash routes, such as `/#/admin/reports`. The existing `/api` proxy points to `http://localhost:8000`; `API_URL` can override that address.

```sh
npm test             # Domain and persistence regression tests
npm run build       # Production build
npm run preview     # Preview the production build
npm run format      # Format source, tests, configuration, and documentation
npm run format:check
```

The sign-in pages show sample accounts. Mock records persist per browser origin, so `localhost` and `127.0.0.1` have separate demo data.

## Supabase integration

Use Node.js 22, matching CI. The installed `@supabase/supabase-js` client is wrapped by `lib/supabase.js` and the injectable `lib/pantryApi.js` service. Copy `.env.example` to `.env` for the public project URL and publishable key; never add a service-role key. Setting these variables does not enable live data in the existing screens.

The service covers Auth, live roles/access, staff-verified student IDs, category-based requests, inventory, stock adjustments, and authenticated availability. The UI uses item/slot-based mock requests and additional workflows without matching backend contracts. Read [the integration boundaries](../docs/architecture/current-stack.md) and [backend setup](../docs/supabase-backend.md) before connecting feature hooks.

Run `node scripts/pantry-terminal.mjs` after `npm ci` to exercise the backend independently. Sample credentials on the UI do not create Supabase users.

## Code organization

```text
src/
  main.jsx                    Mount React and the app providers
  app/
    App.jsx                   Choose authentication, student, or workspace views
    AppProviders.jsx          HeroUI, toast, and pending-action providers
    routes.js                 Navigation links, page groups, and titles
    useAppNavigation.js       Hash navigation, session checks, and sign-out
    WorkspaceLayout.jsx       Staff/admin sidebar and responsive layout
    WorkspaceContent.jsx      Select the workspace feature and loading boundary
  components/
    ui/                       Shared Button, Field, Card, Modal, and other controls
    loading/                  Circular loaders and asynchronous-action context
    Notifications.jsx         Top-center toast provider and helpers
    AdminIcon.jsx             Admin navigation/export icons
  features/
    auth/                     Sign-in, registration, and mock authentication
    student/                  Student pages, request state, and dialogs
    operations/               Dashboard, requests, pickups, and distribution
    stock/                    Inventory, donations, students, and pickup slots
    walk-in/                  Student lookup and provisional-profile flow
    admin/
      reports/                Report screen, fixtures, aggregation, and CSV export
      users/                  Account management, validation, and dialogs
      audit/                  Audit screen, fixtures, and event derivation
  hooks/
    usePersistedState.js      Subscribe to mock storage and record audit changes
  lib/
    mockStorage.js            Storage reads/writes and cross-component events
    mockLatency.js            Abortable simulated backend delays
    dates.js                  Shared admin date formatting
    supabase.js               Environment-configured Supabase client factory
    pantryApi.js              Auth, access, requests, inventory, and RPC service
  assets/                     Imported SVG assets
  styles.css                  Global tokens, shared controls, and workspace styles
  heroui.css                  HeroUI/Tailwind integration
tests/
  admin.test.js               Accounts, permissions, reports, and audit behavior
  operations.test.js          Stock distribution and pickup-date behavior
  storage.test.js             Mock persistence and subscription events
```

Within larger features:

- **Pages** compose the screen and receive the data and callbacks they need.
- **Components** contain reusable sections or dialogs within that feature.
- **Hooks** own related state, validation, and actions.
- **Data files** contain seed records, independent of React pages.
- **Models/utilities** contain calculations and transformations that can be tested without rendering React.
- **Feature CSS** stays beside its feature. `app/App.jsx` imports it in an explicit order to preserve the existing cascade.

Small features keep their few files together instead of adding empty folders. Shared controls are imported directly, for example `components/ui/Button.jsx`. Feature data never imports a page.

## Following a flow

For a staff request, start at `app/WorkspaceContent.jsx`, then `features/operations/OperationsPages.jsx`. Its `useOperations` hook owns the current request/pickup state. The page components render that state, and `utils/distributeInventory.js` handles lot allocation.

For a donation, start at `features/stock/pages/Donations.jsx`. `hooks/useDonationForm.js` owns the donor/item draft and save action; `components/donations/` renders donor details, received items, recent donations, and the details dialog.

For reports or user management, the screen, seed data, and pure logic live together under the corresponding `features/admin/` directory.

## Boundaries to preserve

- Keep shared workflow state in its owning feature controller. Moving state into conditionally mounted page components can reset filters, selections, or drafts during navigation.
- Use `usePersistedState` for mock records that need subscriptions and auditing. `lib/mockStorage.js` is the React-free storage layer used by mock authentication as well.
- Retain existing storage keys and record shapes when reorganizing code so saved demo data continues to work.
- Use the shared `Modal`, `Button`, `AsyncForm`, and loading components to retain HeroUI dialogs, circular loading, cancellation, and disabled-action behavior.
- Route success/error notifications through `components/Notifications.jsx`.
- Keep pure domain logic out of view files. When connecting a backend later, replace mock access inside feature hooks/services while retaining the page interfaces.

This reorganization preserves the existing UI, routes, mock records, interactions, and design assets. See [DESIGN_IMPLEMENTATION.md](./DESIGN_IMPLEMENTATION.md) for screen coverage and design context.
