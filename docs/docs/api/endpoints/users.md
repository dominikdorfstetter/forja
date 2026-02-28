---
sidebar_position: 15
---

# Users and Authentication

User management combines the CMS auth endpoints with Clerk user management and site membership management.

## Endpoints

### Auth

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/auth/me` | Any | Get current auth info (permission, site scope, memberships) |
| GET | `/auth/profile` | Any | Get full user profile (includes Clerk data for JWT users) |
| GET | `/auth/export` | Any | Export all user data (GDPR data portability) |
| DELETE | `/auth/account` | Clerk JWT | Delete the authenticated user's account |

### Clerk User Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/clerk/users?limit&offset` | Admin | List all Clerk users |
| GET | `/clerk/users/{id}` | Admin | Get a Clerk user by ID |
| PUT | `/clerk/users/{id}/role` | Admin | Update a user's CMS role |

### Site Memberships

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/members` | Admin | List site members |
| POST | `/sites/{site_id}/members` | Admin | Add a member to a site |
| PUT | `/sites/{site_id}/members/{id}` | Admin | Update a member's role |
| DELETE | `/sites/{site_id}/members/{id}` | Admin | Remove a member from a site |
| POST | `/sites/{site_id}/members/transfer-ownership` | Owner | Transfer site ownership |

## Auth Info

Quick check of your authentication state and permissions:

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/auth/me
```

**Response** `200 OK`

```json
{
  "permission": "Write",
  "site_id": "site-uuid",
  "auth_method": "api_key",
  "clerk_user_id": null,
  "memberships": null,
  "is_system_admin": null
}
```

## User Profile

For Clerk-authenticated users, includes email, name, avatar URL, and sign-in timestamps:

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/profile
```

## Export User Data

Returns a comprehensive export of all data associated with the authenticated user, including profile, audit logs, API keys, change history, and site memberships. Designed for GDPR data portability compliance.

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/export
```

## Delete Account

Deletes the authenticated user's Clerk account and cleans up all CMS references. Blocked if the user is the sole owner of any site -- ownership must be transferred first.

```bash
curl -X DELETE \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/account
```

**Response** `204 No Content`

Returns `409 Conflict` if the user is the sole owner of a site.

## Manage Clerk Users

List and manage Clerk users for member assignment. Requires Admin role on at least one site or system admin status.

```bash
curl -H "Authorization: Bearer eyJ..." \
  "https://your-domain.com/api/v1/clerk/users?limit=20&offset=0"
```
