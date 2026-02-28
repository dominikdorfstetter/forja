---
sidebar_position: 2
---

# Authentication

All API requests (except public system endpoints) require authentication. OpenYapper supports two authentication methods that can be used interchangeably.

## API Key Authentication

Pass your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites
```

API keys are scoped to a specific site and have a permission level. The key is shown only once at creation time. Keys can be blocked, unblocked, or permanently revoked.

## JWT Authentication (Clerk)

Pass a Clerk-issued JWT in the `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  https://your-domain.com/api/v1/sites
```

JWTs are validated against Clerk's JWKS endpoint with a 15-minute cache. The Clerk `sub` claim is mapped to a deterministic UUID v5 for internal user identification.

## Permission Levels

Permissions are hierarchical -- higher levels inherit all lower-level capabilities:

| Level | Description |
|-------|-------------|
| **Master** | Full system access. Can manage API keys and system configuration. |
| **Admin** | Site administration. Can manage webhooks, site settings, and member roles. |
| **Write** | Content creation and editing. Can create and update blogs, pages, and media. |
| **Read** | Read-only access. Can view all resources but cannot create or modify them. |

### Site Roles (Clerk Users)

Clerk-authenticated users have per-site roles that map to permission levels:

| Site Role | Effective Permission | Notes |
|-----------|---------------------|-------|
| **Owner** | Admin | One per site, can transfer ownership |
| **Admin** | Admin | Can manage site settings and members |
| **Reviewer** | Write | Can approve/reject content in review |
| **Editor** | Write | Can delete content |
| **Author** | Write | Can create and edit content |
| **Viewer** | Read | Read-only access |

## Checking Your Permissions

Use the auth info endpoint to verify your current authentication state:

```bash
# Quick auth check
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/auth/me

# Full profile (includes Clerk user data for JWT auth)
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/profile
```

## Unauthenticated Endpoints

The following endpoints do not require authentication:

- `GET /api/v1/` -- API index (version string)
- `GET /api/v1/health` -- Health check
- `GET /api/v1/config` -- Public frontend configuration
- `GET /api/v1/documents/{id}/download` -- Document file download
