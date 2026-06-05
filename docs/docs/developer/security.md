---
sidebar_position: 11
---

# Security

Security is built into the development workflow, not bolted on after the fact. This page covers the security practices enforced across Forja's backend (Rust), frontend (React), and infrastructure (Railway).

---

## Authentication and Authorization

### Dual Auth Architecture

Forja uses two authentication mechanisms depending on the caller:

| Mechanism | Used By | Verified Via |
|---|---|---|
| Clerk JWT | Admin dashboard (human users) | `Authorization: Bearer <token>` header, verified with Clerk's JWKS endpoint |
| API key | External integrations (machine callers) | `X-API-Key` header, verified against hashed keys stored in the database |

Clerk webhooks are authenticated via HMAC signature using the webhook signing secret. The signature is verified before processing any webhook payload.

### Permission Hierarchy

Roles are ordered from most to least privileged:

```
Owner > Admin > Editor > Author > Reviewer > Viewer > Public
```

Each role subsumes all permissions of roles below it. Access checks use `>=` comparisons, not exact matches.

Named permissions (e.g. `can_moderate`, `can_publish`) should be preferred over raw role checks when a feature needs a capability that doesn't map cleanly to a single role level.

### RBAC in Handlers

Every handler that exposes a protected action must check permissions before touching data:

```rust
// Verify the requesting user has at least Write role for this site
require_role(&auth, &site_id, Role::Write)?;

// For moderation actions, require Admin
require_role(&auth, &site_id, Role::Admin)?;
```

Unauthorized access returns a specific `ApiError` variant with an `ERR_<DOMAIN>_FORBIDDEN` code and HTTP 403 — never a generic 403 with no error code.

---

## Input Validation

### Request Body Validation

All incoming request bodies are validated with typed DTOs. Use the `body.validate()` pattern — do not access raw fields from an unvalidated body:

```rust
let body = body.validate()?;
// Now safe to use body.field_name
```

Validation failures return HTTP 422 with a specific error code and the name of the failing field.

### Parameterized Queries

All database queries use parameterized placeholders. String interpolation in SQL is not permitted — it is a SQL injection vector:

```rust
// Correct — parameterized
sqlx::query!("SELECT * FROM posts WHERE site_id = $1 AND slug = $2", site_id, slug)

// Never — string interpolation
format!("SELECT * FROM posts WHERE slug = '{}'", slug)
```

### File Upload Validation

File uploads enforce:

1. **Content-type allowlist** — only permitted MIME types are accepted; the content-type is validated from the file bytes, not just the request header.
2. **Size limit** — requests exceeding the configured maximum are rejected before the body is fully read.
3. **Filename sanitization** — uploaded filenames are stripped of path separators and special characters before storage.
4. **Storage isolation** — uploaded files are written to an isolated directory outside the web root; they are never executed.

---

## Infrastructure Hardening

### Security Headers

All HTTP responses include:

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Forces HTTPS; prevents protocol downgrade attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer information leakage |
| `Content-Security-Policy` | See below | Restricts resource loading to trusted origins |
| `Permissions-Policy` | Restricts camera, microphone, geolocation | Limits browser feature access |

**CSP policy** restricts scripts, styles, and frames to known origins. Review and tighten the policy when adding new third-party integrations.

### CORS

The CORS allowlist is explicit — it is not a wildcard (`*`). Only the production dashboard origin and localhost (for development) are permitted.

When adding a new integration that requires cross-origin access, add the specific origin to the allowlist and document why.

### Rate Limiting

Public endpoints (login, signup, API key verification, webhooks) are rate-limited per IP. Authenticated endpoints are rate-limited per user/site to prevent abuse.

If a new endpoint is unauthenticated or handles high-value actions (password reset, bulk operations), rate limiting must be specified as part of the feature design.

### Environment Variables

Production environment:

- `RUST_LOG` must be set to `warn` or `error` — never `debug` or `trace` in production. Debug logs can leak sensitive data (query parameters, user IDs, internal paths).
- `RUST_BACKTRACE` must be `0` in production. Stack traces expose internal structure.
- Database credentials, API keys, and signing secrets must be stored as Railway environment variables — never committed to the repository.

---

## Dependency Management

### Scheduled Audits

Run dependency audits regularly and before every release:

```bash
# Rust dependencies
cargo audit

# Node.js dependencies (production only)
cd admin && npm audit --production
```

### Container Image Scanning

Container images are scanned with [Trivy](https://trivy.dev/) for known CVEs in OS packages and application dependencies:

```bash
trivy image <image-name>:<tag>
```

Address Critical and High severity findings before shipping a release.

### Update Policy

- **Patch updates** — apply promptly (security fixes, bug fixes)
- **Minor updates** — review changelog, apply within a sprint
- **Major updates** — plan as a dedicated task; test thoroughly
- **Yanked crates / deprecated packages** — replace immediately

---

## Security Auditing

Use the `/hacker-kathy` skill to run a structured white-hat security audit of Forja. Kathy performs a systematic OWASP Top 10 review, writes proof-of-concept for each finding, creates GitHub issues for Medium+ severity findings, and produces a hardening checklist for Railway.

**Audit modes:**

| Mode | Scope |
|---|---|
| `/hacker-kathy` (no flag) | Full audit — all phases |
| `/hacker-kathy --api` | API layer only (handlers, auth, validation) |
| `/hacker-kathy --frontend` | Frontend only (XSS, CSP, client-side auth) |
| `/hacker-kathy --infra` | Infrastructure only (Railway config, headers, CORS) |
| `/hacker-kathy --deps` | Dependencies only (`cargo audit`, `npm audit`) |
| `/hacker-kathy --endpoint <path>` | Single endpoint deep-dive |

**Kathy's rules:**
- Never exploits production data
- Never modifies code
- Never stores secrets in issue bodies
- Always asks for approval before running Railway commands that modify state

Run a full audit before each major release and after any significant infrastructure change.
