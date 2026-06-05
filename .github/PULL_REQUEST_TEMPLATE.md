<!-- Thanks for contributing to Forja! Fill in the sections below. -->

## Summary

<!-- What does this PR change, and why? -->

## Related issue

<!-- e.g. Closes #123 -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] Feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Refactor (no behavior change)
- [ ] Docs / chore

## Checklist

- [ ] Tests added or updated, and the suite passes locally
- [ ] `main` CI (the **CI Pass** check) is green
- [ ] Backend changes: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` pass
- [ ] Admin changes: lint + typecheck + tests pass, and **react-doctor scores 100/100**
- [ ] DTO/route changes: regenerated the SDK (`npm run generate:openapi`) and committed `admin/src/generated/api-types.ts`
- [ ] User-facing admin copy: backfilled **all 11 locales** (no fallback-only strings)
- [ ] Schema changes: added a **new** migration (never edited an existing one)
- [ ] Updated `CHANGELOG.md` and any affected docs/ADRs
- [ ] No secrets, credentials, or PII committed

## Screenshots / notes

<!-- For UI changes, before/after screenshots help. Anything reviewers should know? -->
