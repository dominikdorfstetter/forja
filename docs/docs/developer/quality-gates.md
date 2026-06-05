---
sidebar_position: 5
---

# Quality Gates

Every change to Forja must pass four quality gates before it is merged. These are not optional checklists — they are enforced as hard requirements in the `resolve-issue` and `run-checks` skills.

---

## Gate 1 — Full Test Suite

Run the complete test suite regardless of whether your change is backend-only, frontend-only, or full-stack. A backend DTO rename can silently break a frontend type import; running everything catches cross-boundary regressions.

```bash
# Always run the full suite
./scripts/dev-test.sh

# If backend changes touched handlers or models, also run integration tests
# (requires PostgreSQL running):
./scripts/dev-test.sh --backend --integration
```

**Pass condition:** Exit code 0. Every test green. No skipped tests without an explicit reason.

**Show the full output.** Do not summarize. Do not claim success without pasting the actual command output.

If any check fails:

1. Fix the failure — do not skip or suppress
2. Re-run the **full** suite (not just the failing check)
3. Show the new output

---

## Gate 2 — React Doctor (frontend changes only)

React Doctor analyzes React component health: unnecessary re-renders, missing memoization, unstable references, and component complexity.

```bash
# Offline analysis (quick local check, no network)
cd admin && npm run react-doctor

# Online analysis with score enforcement (the authoritative check)
cd admin && npm run react-doctor:online
```

**Pass condition:** Score must be **100**. Any score below 100 is a blocking failure — do not proceed with commit or PR.

If the change is backend-only with no `admin/src/` file changes, skip this gate and note: `React Doctor: skipped (backend-only change)`.

React Doctor runs separately from `dev-test.sh` because it requires network access.

### Common Fixes

| Finding | Fix |
|---|---|
| Unnecessary re-render | Wrap with `React.memo()` or stabilize props with `useMemo`/`useCallback` |
| Unstable reference | Move object/array literals out of render, use `useMemo` |
| Missing key prop | Add stable `key` to list items (not array index) |
| Large component | Split into sub-components (see File Focus in coding principles) |
| Prop drilling | Extract to context or compose with hooks |

---

## Gate 3 — Documentation

Features and bug fixes require documentation updates. Pure refactors and skill-only changes are exempt.

| Change Type | Required Documentation Update |
|---|---|
| New API endpoint | Create or update `docs/docs/api/endpoints/<domain>.md` |
| New admin page | Create or update `docs/docs/admin-guide/<feature>.md` |
| New configuration option | Update `docs/docs/getting-started/configuration.md` or `docs/docs/deployment/environment-variables.md` |
| Changed behavior | Update the relevant existing doc page |
| Bug fix (user-visible) | Add to `docs/docs/changelog.md` |
| New major feature | Update feature list in root `README.md` |
| New dev workflow | Update the relevant sub-package `README.md` |
| Changed prerequisites | Update getting-started docs |

**Changelog format** for features and non-trivial bug fixes:

```markdown
### Unreleased
- **feat(<scope>):** <one-line description> (#<issue>)
- **fix(<scope>):** <one-line description> (#<issue>)
```

If no documentation update is needed, state why: `Docs: no update needed (backend-only refactor)`.

---

## Gate 4 — Issue Completeness

Before implementation begins, the issue must have all required sections. This is validated as part of the `resolve-issue` skill's Phase 3 — Requirement Gate.

### Required Sections

| Section | Required When | If Missing |
|---|---|---|
| Acceptance Criteria | Always | Ask user for success definition |
| Access Control matrix | Feature has actions | Auto-generate from codebase role model, confirm with user |
| Error Cases table | Feature can fail | Auto-generate from handler/DTO analysis, confirm with user |
| Test Strategy table | Always | Auto-generate using Test Manager mindset, confirm with user |
| i18n keys | User-facing strings exist | Propose keys from existing namespace structure in `admin/src/i18n/locales/en.json` |
| WCAG notes | New UI elements | Add based on component type (keyboard, focus, ARIA) |

### Acceptance Criteria

Must be testable. Each criterion must have a clear pass/fail outcome. Vague criteria like "works correctly" are not acceptable.

### Access Control Matrix

Every action must list which roles can and cannot perform it:

| Action | Viewer | Editor | Reviewer | Admin | System Admin |
|---|---|---|---|---|---|
| `<action>` | No | Yes | Yes | Yes | Yes |

Use the permission hierarchy: `Owner > Admin > Editor > Author > Reviewer > Viewer > Public`.

### Error Cases Table

Every failure path needs a code, HTTP status, and i18n key:

| Trigger | Error Code | HTTP | i18n Key |
|---|---|---|---|
| Unauthorized role | `ERR_<DOMAIN>_FORBIDDEN` | 403 | `errors.<domain>.forbidden` |
| Validation failure | `ERR_<DOMAIN>_<CAUSE>` | 422 | `errors.<domain>.<cause>` |

### Test Strategy Table

Must cover at minimum: happy path, permissions, validation, and one edge case:

| Category | Scenario | Expected Outcome |
|---|---|---|
| Happy path | `<user action>` | `<result>` |
| Permission | `<denied role attempts action>` | `ERR_<CODE>`, 403 |
| Validation | `<field at boundary>` | `ERR_<CODE>`, 422 |
| Edge case | `<state/timing/data edge>` | `<graceful handling>` |

---

## Gate Summary

Before merging, confirm all gates:

```
Gate 1 — Tests:       PASSED (all checks green) | FAILED (see output)
Gate 1 — Integration: PASSED | SKIPPED (reason)
Gate 2 — React Doctor: 100 | SKIPPED (backend-only)
Gate 3 — Docs:        UPDATED (<which files>) | NOT NEEDED (<reason>)
Gate 3 — Changelog:   UPDATED | NOT NEEDED (<reason>)
Gate 4 — Issue:       COMPLETE (all required sections present)
```

Do not merge if any required gate is missing or failing.
