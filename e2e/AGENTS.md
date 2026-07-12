# e2e — End-to-end tests

Cucumber (Gherkin BDD) driven by Playwright, exercising the real stack with real
Clerk authentication across all roles (Viewer → System Admin). A fresh database
is spun up per run via Docker Compose.

## Layout

- `features/` — `.feature` files (Gherkin scenarios), grouped by area (auth,
  content, media, members, navigation, analytics, api-keys, redirects, …).
- `step-definitions/` — step implementations.
- `support/` — Cucumber world, hooks, and shared helpers.
- `fixtures/` — upload test files (`test-image.png`, `test-blocked-ext.exe`) — not seed data.
- `auth-states/` — stored Clerk sessions per role (so each scenario doesn't re-login).
- `scripts/run-e2e.sh` — boots the test DB, then **checks** that the backend
  (`:8000`) and admin (`:3000`) are already running (exits 1 otherwise) and runs
  the suite — it does not start them itself.
- `docker-compose.test.yaml` — isolated Postgres/Redis for the run.
- `reports/` — generated run output (git-ignored).

## Commands

```bash
npm install
npx playwright install chromium
cp .env.example .env          # set Clerk test-instance keys + 7 test users
./scripts/run-e2e.sh          # full suite
npm test -- --tags "@auth"    # run by tag
```

## Conventions

- Tests select elements by **`data-testid`** (added in the admin), not brittle CSS.
- Requires a Clerk **development** instance with the test accounts configured.
- Some specs include `And I take a screenshot` steps; their output goes to
  `docs/screenshots/` (separate from the Docusaurus capture pipeline).
- Playwright is also reused by `docs/scripts/capture-screenshots.mjs` (resolved
  from this workspace's `node_modules`).
