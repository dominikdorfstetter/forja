# e2e — End-to-end tests

Cucumber (Gherkin BDD) driven by Playwright, exercising the real stack with real
Clerk authentication across all roles (Viewer → System Admin). A fresh database
is spun up per run via Docker Compose.

## Layout

- `features/` — `.feature` files (Gherkin scenarios), grouped by area (auth,
  content, media, members, navigation, analytics, api-keys, redirects, …).
- `step-definitions/` — step implementations.
- `support/` — Cucumber world, hooks, and shared helpers.
- `fixtures/` — seed data and test users.
- `auth-states/` — stored Clerk sessions per role (so each scenario doesn't re-login).
- `scripts/run-e2e.sh` — entry point that boots infra + backend and runs the suite.
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
