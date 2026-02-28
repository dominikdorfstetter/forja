---
sidebar_position: 8
---

# Contributing

Thank you for your interest in contributing to OpenYapper. This guide covers the contribution workflow, from setting up your environment to submitting a pull request.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/openyapper.git
   cd openyapper
   ```
3. **Set up the development environment** by following the [Prerequisites](../getting-started/prerequisites) and [Installation](../getting-started/installation) guides.
4. **Start the dev environment**:
   ```bash
   ./scripts/dev-start.sh
   ```

## Contribution Workflow

### 1. Create a Branch

Create a feature branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Use descriptive branch names:

- `feature/add-bookmarks` -- new feature
- `fix/cors-header-missing` -- bug fix
- `docs/update-api-reference` -- documentation
- `refactor/simplify-auth-guard` -- code improvement

### 2. Make Your Changes

Follow the coding standards documented in [Coding Standards](./coding-standards):

- **Backend**: `cargo fmt` for formatting, `cargo clippy -- -D warnings` for linting.
- **Admin**: `npm run typecheck` for types, `npm run lint` for linting.

### 3. Write Tests

- Add unit tests for new backend logic.
- Add integration tests if the feature involves database operations.
- Add component tests for new admin UI features.

### 4. Verify Locally

Run the full test suite before pushing:

```bash
./scripts/dev-test.sh
```

For backend changes that touch the database, include integration tests:

```bash
./scripts/dev-test.sh --integration
```

### 5. Commit Your Changes

Write clear, descriptive commit messages:

```bash
git add -A
git commit -m "Add bookmark management endpoints"
```

Commit message guidelines:

- Use the imperative mood ("Add feature" not "Added feature").
- Keep the first line under 72 characters.
- Add a blank line and a longer description if the change is non-trivial.

### 6. Push and Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Open a pull request on GitHub against the `main` branch. In the PR description:

- Describe what the change does and why.
- Reference any related issues (e.g., "Closes #42").
- Note any breaking changes or migration steps.

### 7. Code Review

A maintainer will review your pull request. Be prepared to:

- Respond to feedback and make adjustments.
- Rebase on `main` if the branch falls behind.
- Squash fixup commits before merge if requested.

## What Makes a Good Contribution

### Bug Fixes

- Include a test that reproduces the bug.
- Explain the root cause in the PR description.

### New Features

- Discuss the feature in an issue before starting work to confirm it aligns with the project direction.
- Follow the existing patterns (model/DTO/handler for backend, types/service/page for admin).
- Add API documentation via `#[utoipa::path(...)]` macros.
- Update the OpenAPI spec by registering paths and schemas in `openapi.rs`.

### Documentation

- Fix typos, clarify existing docs, or add missing documentation.
- Documentation changes do not require tests.

## Development Resources

- [Project Structure](./project-structure) -- understand the monorepo layout.
- [Backend Guide](./backend-guide) -- how to add a new API resource.
- [Admin Guide](./admin-guide) -- how to add a new admin page.
- [Testing](./testing) -- how to run and write tests.
- [Database Migrations](./database-migrations) -- how to modify the schema.
- [CI/CD](./ci-cd) -- what the automated pipeline checks.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this standard. Please report unacceptable behavior to the project maintainers.

## License

By contributing to OpenYapper, you agree that your contributions will be licensed under the [AGPL-3.0-or-later](https://www.gnu.org/licenses/agpl-3.0.html) license.
