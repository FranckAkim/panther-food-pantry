# How we work

## Branches and pull requests

- `main` is always deployable. Nobody pushes to it directly.
- One branch per Jira issue: `feature/PANTRY-12-donation-intake`, `fix/PANTRY-30-slot-capacity`.
- Open a pull request early; mark it Draft until ready.
- A PR merges when **CI is green** and **one teammate approved** it.
- Keep PRs small: under ~300 changed lines is a good target.

## Commit messages

```
feat(inventory): record a donation as new lots
fix(requests): reject slots in the past
test(distribution): two simultaneous hand-outs of the last item
docs: update architecture decisions
```

## Definition of done

- [ ] Acceptance criteria from the Jira issue are met
- [ ] Relevant frontend/helper tests pass with `npm test`; `npm run build` passes in `frontend/`
- [ ] For Python changes, `pytest`, `ruff check .`, and `ruff format --check .` pass in `backend/`
- [ ] Supabase schema/RPC changes include relevant SQL policy and invariant checks; record separately how they were run
- [ ] New endpoints, database policies, and RPCs declare/enforce allowed roles
- [ ] Docs updated if behavior or setup changed

## Module boundaries

Read [the current stack](docs/architecture/current-stack.md) before starting integration work. React features live in `frontend/src/features/`; the current screens use mock storage. Put Supabase calls behind the shared `frontend/src/lib/pantryApi.js` service and feature adapters, rather than importing the client into page components. Preserve mock record keys while the demo remains supported.

Business authorization and stock invariants belong in `supabase/` policies and SQL functions. Use stock RPCs rather than direct quantity or ledger writes. Service-role credentials belong only in server/Edge Function environments. FastAPI currently owns health checks and static hosting; the original planned business routers are not present.

Request statuses, UUIDs, category requests, and stock records differ between the demo and backend. Agree on adapters/contracts before replacing mock feature hooks. See [the backend guide](docs/supabase-backend.md) for fresh-project SQL order and existing-project upgrade instructions.
