---
title: Authentication & Authorization
sidebar_position: 5
description: Dual authentication system, permission levels, and Clerk integration.
---

# Authentication & Authorization

Forja supports two authentication methods, evaluated in order for every protected request:

1. **Clerk JWT** -- `Authorization: Bearer <token>` header (used by the admin dashboard)
2. **API Key** -- `X-API-Key` header (used by frontend templates and machine clients)

Both methods resolve to the same `AuthenticatedKey` struct, giving handlers a uniform interface regardless of how the caller authenticated.

## Auth Extractor

Authentication is implemented as an Axum extractor (`FromRequestParts` trait), defined in `axum_app/extractors.rs`. When a protected handler declares `auth: AuthenticatedKey` as a parameter, Axum runs the extractor before the handler executes; if the extractor returns an `ApiError`, Axum's `IntoResponse` impl turns it into a 401 / 403 RFC 7807 ProblemDetails response without the handler body ever running.

```
Incoming Request
       │
       ▼
┌──────────────────────┐
│ Check Authorization  │──── Has "Bearer" token? ────▶ Validate Clerk JWT
│ header               │                                    │
└──────────────────────┘                                    ▼
       │ No                                          ┌─────────────┐
       ▼                                             │ Decode JWT  │
┌──────────────────────┐                             │ via JWKS    │
│ Check X-API-Key      │                             └──────┬──────┘
│ header               │                                    │
└──────────┬───────────┘                              Valid? │
           │                                           Yes  ▼
           ▼                                     AuthenticatedKey {
     Validate key hash                             id: UUID v5(sub),
     against DB                                    permission: Read,
           │                                       auth_source: ClerkJwt
           ▼                                     }
     AuthenticatedKey {
       id: key UUID,                             (Site role resolved
       permission: from DB,                       via site_memberships
       site_id: from DB,                          table at action time)
       auth_source: ApiKey
     }
```

## Permission Levels

### API Key Permissions

API keys carry one of four permission levels, stored in the `api_keys` table:

| Level | Can Read | Can Write | Can Admin | Can Manage Keys |
|-------|----------|-----------|-----------|-----------------|
| **Master** | Yes | Yes | Yes | Yes |
| **Admin** | Yes | Yes | Yes | No |
| **Write** | Yes | Yes | No | No |
| **Read** | Yes | No | No | No |

The hierarchy is: **Owner > Admin > Editor > Author > Reviewer > Viewer**.

### Site Roles (Clerk Users)

Clerk-authenticated users have their permissions determined by the `site_members` table, which assigns a role per site:

| Role | Equivalent API Key Level |
|------|--------------------------|
| **Owner** | Master |
| **Admin** | Admin |
| **Editor** | Write |
| **Viewer** | Read |

When a Clerk user makes a request, the system resolves their effective role for the target site by looking up the `site_members` table. System admins (see below) implicitly have the **Owner** role on all sites.

### Unified Authorization

Authorization uses a granular **permission model** instead of rank-based role checks. Each handler declares the specific permission it requires (e.g., `blog:create`, `settings:update`).

```
User authenticates (Clerk JWT or API Key)
       │
       ▼
PermissionService::require(pool, auth, site_id, Permission)
       │
       ├── Resolve effective SiteRole for this site
       ├── Map role → HashSet<Permission> via role_permissions()
       └── Check if the required permission exists in the set
```

Permissions follow `{resource}:{action}[:{scope}]` format:

| Format | Example | Meaning |
|--------|---------|---------|
| `resource:action` | `blog:create` | Unscoped — any user with this permission |
| `resource:action:own` | `blog:update:own` | Only the content creator |
| `resource:action:any` | `blog:update:any` | Any content, regardless of creator |
| `resource:action:published` | `blog:update:published` | Only for content in Published/Scheduled/Archived status |

When checking an unscoped permission like `blog:update`, the system also matches scoped variants (`:own`, `:any`, `:published`).

**Role → Permission mapping:**

| Role | Key Permissions |
|------|----------------|
| **Viewer** | `*:read` (13 resources) |
| **Reviewer** | + `blog:review`, `page:review`, `document:review` |
| **Author** | + `*:create`, `*:update:own`, `*:delete:own`, `media:upload` |
| **Editor** | + `*:update:any`, `*:delete:any`, `*:publish`, `*:update:published` |
| **Admin** | + `settings:*`, `webhook:*`, `api_key:*`, `member:*`, `audit:read`, `site:update` |
| **Owner** | + `site:delete`, `member:transfer`, `api_key:manage` |

**Resource ownership:** When a handler checks `blog:update`, the `PermissionService` evaluates three layers:
1. Does the user have `:any` scope? → Access granted (Editor+)
2. Is the content Published/Scheduled/Archived? → Require `:published` permission
3. Does the user have `:own` scope and is the content creator? → Access granted

**Frontend integration:** The `/auth/me` endpoint returns resolved permission strings per site membership. The `usePermissions()` React hook provides `can()`, `canAny()`, `canAll()` functions that mirror the backend logic.

## Clerk JWT Validation

When a request includes an `Authorization: Bearer <token>` header, the auth guard validates the JWT:

1. **Decode the JWT header** to extract the `kid` (Key ID).
2. **Fetch the JWKS** (JSON Web Key Set) from Clerk's endpoint. Keys are cached for 15 minutes.
3. **Find the matching key** by `kid` in the JWKS.
4. **Validate the signature** using RS256 algorithm.
5. **Extract claims** -- the `sub` (subject) field contains the Clerk user ID (e.g., `user_2abc...`).

### JWKS Caching

The `ClerkJwksState` struct maintains a cached copy of Clerk's public keys:

```rust
pub struct ClerkJwksState {
    jwks_url: String,
    cache: tokio::sync::RwLock<Option<CachedJwks>>,
}

struct CachedJwks {
    keys: jsonwebtoken::jwk::JwkSet,
    fetched_at: std::time::Instant,
}
```

Keys are refreshed when the cache is older than 15 minutes. This avoids hitting Clerk's API on every request while still picking up key rotations.

### JWKS URL Configuration

The JWKS URL is configured via the `CLERK_JWKS_URL` environment variable. If not set, the system attempts to derive it from the Clerk secret key.

## UUID Generation for Clerk Users

Clerk users do not have UUIDs natively (their IDs are strings like `user_2abc...`). To integrate with the UUID-based data model, Forja generates a deterministic UUID v5 from the Clerk user ID:

```rust
pub const CLERK_UUID_NAMESPACE: Uuid = Uuid::from_bytes([...]);
let user_uuid = Uuid::new_v5(&CLERK_UUID_NAMESPACE, clerk_user_id.as_bytes());
```

This means:
- The same Clerk user always gets the same UUID.
- No database lookup is needed to resolve the mapping.
- The UUID can be used as `author_id` on content records.

## System Admins

System admins have unrestricted access to all sites and operations. They are identified by their Clerk user ID and stored in the `system_admins` table.

### Seeding via Environment Variable

On startup, the backend reads the `SYSTEM_ADMIN_CLERK_IDS` environment variable (comma-separated list of Clerk user IDs) and inserts them into the `system_admins` table:

```bash
SYSTEM_ADMIN_CLERK_IDS=user_2abc123,user_2def456
```

This is an upsert operation (`ON CONFLICT DO NOTHING`), so it is safe to include existing admins.

### System Admin Behavior

When a system admin makes a request:
- `auth.is_system_admin(pool)` returns `true`.
- `auth.effective_site_role(pool, site_id)` returns `SiteRole::Owner` for any site.
- No explicit `site_members` record is needed.

For API key auth, a `Master`-level key is treated as equivalent to a system admin.

## API Key Validation

API keys are stored as SHA-256 hashes in the database. The raw key is never persisted. Validation follows these steps:

1. Hash the provided key with SHA-256.
2. Look up the hash in the `api_keys` table.
3. Check that the key status is `Active`.
4. Check expiration date (if set).
5. Verify site scope (if the key is scoped to a specific site).
6. Extract rate limit settings for the key.
7. Record usage (timestamp and IP, fire-and-forget).

## Rate Limiting in the Auth Guard

After successful API key authentication, the guard checks rate limits if Redis is available:

1. **Resolve client IP** -- when `TRUST_PROXY_HEADERS=true`, the real client IP is extracted from `X-Forwarded-For` or `X-Real-IP` headers (for correct behavior behind reverse proxies). Otherwise, the direct connection IP is used.
2. **IP-based rate limit** -- global, per-IP (skipped for loopback addresses `127.0.0.1` / `::1`).
3. **Key-based rate limit** -- per API key, using the key's configured limits.

If either limit is exceeded, the guard returns `429 Too Many Requests` with an RFC 7807 error body. Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are set on every response.

If Redis is unavailable, the `RATE_LIMIT_FAIL_MODE` setting determines whether requests are allowed through (`open`, default) or rejected (`closed`). See [Rate Limiting](./rate-limiting) for details.

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `CLERK_SECRET_KEY` | Clerk API secret (enables JWT auth) | No |
| `CLERK_JWKS_URL` | JWKS endpoint URL | No (derived if not set) |
| `SYSTEM_ADMIN_CLERK_IDS` | Comma-separated Clerk user IDs for system admin seeding | No |
