# Contributing to Forja

Thanks for your interest in contributing! Forja is a GDPR-first, multi-tenant
headless CMS — a Rust (Axum) backend and a React (MUI Material 3) admin SPA in a
monorepo. This page is the quick start; the in-depth guide lives in the
[Developer Documentation](https://forja-docs.dorfstetter.at/docs/developer/contributing).

## Code of Conduct

This project adheres to a [Code of Conduct](./CODE_OF_CONDUCT.md). By
participating, you are expected to uphold it. Report unacceptable behavior to
**dominik@dorfstetter.at**.

## License of contributions

Forja is licensed under **AGPL-3.0-or-later** (see [LICENSE](./LICENSE)). By
submitting a contribution you agree that it is licensed under the same terms.

## Repository layout

| Path | What |
|---|---|
| `backend/` | Rust / Axum API (PostgreSQL via SQLx, Redis) |
| `admin/` | React 19 + MUI Material 3 admin SPA |
| `libs/` | Published packages — `@forjacms/client` (Angular SDK), `sections`, `sections-react`, `analytics` |
| `templates/astro-blog/` | Reference Astro consumer site |
| `docs/` | Docusaurus documentation + ADRs |
| `e2e/` | Cucumber end-to-end suite |

## Development workflow

1. **Fork & branch.** Create a topic branch from `main`
   (`feat/…`, `fix/…`, `refactor/…`, `docs/…`).
2. **Develop test-first.** Tests are the contract — add or update them with every
   behavior change. See the [testing guide](https://forja-docs.dorfstetter.at/docs/developer/testing).
3. **Run the gates locally** before pushing:
   - Backend: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`
   - Admin: `npm run lint`, `npm run typecheck`, `npm test` (and **react-doctor 100/100**)
   - If you changed a DTO/route: regenerate the SDK with `npm run generate:openapi` and commit `admin/src/generated/api-types.ts`
   - If you changed admin copy: backfill **all 11 locales** (`ar, de-AT, de, en, es, fr, it, nl, pl, pt, uk`)
4. **Open a pull request** against `main`. CI must be green (the **CI Pass** check
   gates merges) and conversations resolved. Keep history linear (squash merge).
5. **Conventional commits** are preferred for titles, e.g.
   `feat(forms): add CSV export`, `fix(auth): scope role update to site`.

## Reporting bugs & requesting features

Use the [issue templates](https://github.com/dominikdorfstetter/forja/issues/new/choose).
For **security vulnerabilities, do not open a public issue** — follow
[SECURITY.md](./SECURITY.md).

## Architecture decisions

Significant design choices are recorded as ADRs under
[`docs/adr/`](./docs/adr). Read the relevant ADR before reworking a subsystem,
and add a new one when you make a decision worth recording.
