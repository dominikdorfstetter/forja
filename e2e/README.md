# Forja E2E Tests

End-to-end tests for Forja using [Cucumber](https://cucumber.io/) (Gherkin BDD) with [Playwright](https://playwright.dev/) as the browser driver.

## Overview

- **109 scenarios** across 15 feature areas
- **7 roles** tested: Viewer, Reviewer, Author, Editor, Admin, Owner, System Admin
- **Real Clerk authentication** — tests log in via the actual Clerk UI
- **Documentation screenshots** — explicit `And I take a screenshot` steps output to `docs/screenshots/`
- **Fresh database** per test run via Docker Compose

## Prerequisites

1. **Docker** — for test database (Postgres + Redis)
2. **Node.js 22+** — for running Cucumber (Cucumber 13 supports Node 22, 24, and 26+)
3. **Rust toolchain** — for running the backend
4. **Clerk development instance** — with 7 test user accounts
5. **sqlx-cli** — for running database migrations (`cargo install sqlx-cli`)

## Quick Start

```bash
# 1. Install dependencies
cd e2e
npm install
npx playwright install chromium

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your Clerk test credentials

# 3. Start infrastructure + backend + admin (in separate terminals)
./scripts/setup-test-db.sh                    # Test DB on :5433, Redis on :6380
cd ../backend && cargo run                     # Backend on :8000
cd ../admin && npm run dev                     # Admin on :3000

# 4. Run tests
npm test                                       # All tests
npm test -- features/auth/login.feature        # Single feature
npm test -- --tags "@sites"                    # By tag
E2E_HEADLESS=false npm test                    # Visible browser

# Or use the convenience script (checks all services first):
./scripts/run-e2e.sh
```

## Project Structure

```
e2e/
├── features/              # Gherkin .feature files (organized by domain)
│   ├── auth/              # Login, profile, account deletion
│   ├── sites/             # Site CRUD, settings, deletion
│   ├── members/           # Invite, role change, removal, ownership transfer
│   ├── content/           # Blog publishing, pages, documents, multilingual
│   ├── api-keys/          # API key management with permission caps
│   ├── media/             # Upload, folders, file management
│   ├── webhooks/          # Webhook CRUD and delivery logs
│   ├── navigation/        # Site navigation management
│   ├── redirects/         # URL redirect management
│   ├── analytics/         # Analytics dashboard
│   ├── activity/          # Activity log and notifications
│   ├── social-links/      # Social media link configuration
│   ├── system-admin/      # System admin privileges
│   └── ui/                # Empty states, pagination, sorting, filtering
├── step-definitions/      # TypeScript step implementations
│   └── common/            # Reusable steps (auth, nav, screenshots, forms)
├── support/               # Framework infrastructure
│   ├── world.ts           # Cucumber World with Playwright browser/context
│   ├── hooks.ts           # Before/After lifecycle hooks
│   ├── clerk-auth.ts      # Real Clerk login with session caching
│   └── config.ts          # Environment variable loading
├── fixtures/              # Test files (images, etc.)
├── scripts/               # Setup and run scripts
├── reports/               # Generated test reports (gitignored)
├── cucumber.js            # Cucumber configuration
└── docker-compose.test.yaml
```

## Test Roles

| Role | Site Rank | Can Create | Can Edit All | Can Manage Members | Can Delete Site |
|------|-----------|------------|--------------|--------------------|-----------------|
| Viewer | 10 | No | No | No | No |
| Reviewer | 20 | No | No | No | No |
| Author | 30 | Yes | No | No | No |
| Editor | 40 | Yes | Yes | No | No |
| Admin | 50 | Yes | Yes | Yes | No |
| Owner | 60 | Yes | Yes | Yes | Yes |
| System Admin | N/A | Yes | Yes | Yes | Yes (all sites) |

## Writing New Tests

### Add a new scenario

1. Create or edit a `.feature` file in `features/<domain>/`
2. Use existing step definitions from `step-definitions/common/` where possible
3. Add domain-specific steps in `step-definitions/<domain>.steps.ts`
4. Run `npm run test:dry` to verify parsing

### Common step patterns

```gherkin
Given I am logged in as "editor"
And I am on site "E2E Test Blog"
When I navigate to "blogs"
And I click "New Post"
And I fill in the blog editor with:
  | field | value       |
  | title | My New Post |
Then I should see "Post saved"
And I take a screenshot "content/my-new-post"
```

### Tags

Use tags for selective test runs:
- `@auth`, `@sites`, `@members`, `@content`, `@api-keys`, `@media`
- `@webhooks`, `@navigation`, `@redirects`
- `@analytics`, `@activity`, `@social-links`, `@system-admin`, `@ui`

```bash
npm test -- --tags "@auth"
npm test -- --tags "@content and not @multilingual"
```

## Screenshots

Documentation screenshots are saved to `docs/screenshots/` and organized by feature area. These are intended for use in Docusaurus documentation.

To regenerate all screenshots:
```bash
npm test  # Screenshots are captured during test execution
```

## Reports

Test reports are generated in `reports/`:
- `cucumber-report.json` — machine-readable JSON report
- `cucumber-report.html` — human-readable HTML report

## Docker

Test infrastructure runs on separate ports from dev to avoid conflicts:
- **PostgreSQL**: port 5433 (dev uses 5432)
- **Redis**: port 6380 (dev uses 6379)
- **Database**: uses `tmpfs` for RAM-backed storage (fast, ephemeral)
