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
- [ ] Tests added or updated; `pytest` passes
- [ ] `ruff check` and `ruff format --check` pass
- [ ] New endpoints declare which roles may call them
- [ ] Docs updated if behavior or setup changed

## Module boundaries

Each module (`requests`, `inventory`, `distribution`, `reports`) owns its tables. Other modules call its functions; they never write its tables directly. Ask in the team channel before crossing a boundary.
