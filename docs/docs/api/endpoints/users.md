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
| GET | `/auth/preferences` | Clerk JWT | Get user preferences |
| PUT | `/auth/preferences` | Clerk JWT | Update user preferences |
| GET | `/auth/help-state` | Clerk JWT | Get UI help state |
| PUT | `/auth/help-state` | Clerk JWT | Update help state |
| DELETE | `/auth/help-state` | Clerk JWT | Reset help state |
| GET | `/auth/onboarding` | Clerk JWT | Get user onboarding state |
| POST | `/auth/onboarding/complete` | Clerk JWT | Complete user onboarding |

### Clerk User Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/clerk/users?limit&offset` | Admin | List all Clerk users (includes moderation status) |
| GET | `/clerk/users/{id}` | Admin | Get a Clerk user by ID (includes moderation status) |
| PUT | `/clerk/users/{id}/role` | Admin | Update a user's CMS role |

### User Moderation

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/admin/users/{clerk_user_id}/suspend` | System Admin | Suspend a user for a specified duration |
| POST | `/admin/users/{clerk_user_id}/ban` | System Admin | Permanently ban a user |
| POST | `/admin/users/{clerk_user_id}/unsuspend` | System Admin | Lift a suspension (not applicable to bans) |
| DELETE | `/admin/users/{clerk_user_id}` | System Admin | Delete a banned user and all associated data |

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

## User Preferences

Returns the authenticated user's preferences with defaults merged in. Requires Clerk JWT.

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/preferences
```

**Response** `200 OK`

```json
{
  "autosave_enabled": true,
  "autosave_debounce_seconds": 3,
  "language": "en",
  "theme_id": "system",
  "page_size": 25
}
```

## Update User Preferences

Updates user preferences. All fields are optional -- only provided fields are changed. Requires Clerk JWT.

```bash
curl -X PUT \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "language": "de",
    "theme_id": "mocha",
    "page_size": 50
  }' \
  https://your-domain.com/api/v1/auth/preferences
```

**Response** `200 OK` -- Returns the full updated `UserPreferencesResponse`.

## Get Help State

Returns the user's UI help system state, tracking which tooltips, hotspots, and tours have been seen or dismissed. Requires Clerk JWT.

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/help-state
```

**Response** `200 OK`

```json
{
  "tour_completed": false,
  "hotspots_seen": ["dashboard_site_selector"],
  "field_help_seen": ["editor_slug_field"]
}
```

## Update Help State

Dismisses a hotspot, field help tooltip, or marks the tour as completed. Requires Clerk JWT.

```bash
curl -X PUT \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "dismiss_hotspot": "editor_slash_commands"
  }' \
  https://your-domain.com/api/v1/auth/help-state
```

**Response** `200 OK` -- Returns the full updated `HelpStateResponse`.

## Reset Help State

Resets all help state to defaults (tour not completed, no hotspots or field help dismissed). Requires Clerk JWT.

```bash
curl -X DELETE \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/help-state
```

**Response** `200 OK`

## Get Onboarding State

Returns the user's onboarding survey state, including whether it has been completed and the answers provided. Requires Clerk JWT.

```bash
curl -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/auth/onboarding
```

**Response** `200 OK`

```json
{
  "completed": false,
  "user_type": null,
  "intents": [],
  "completed_at": null
}
```

## Complete User Onboarding

Submits the onboarding survey. The `user_type` must be one of `solo`, `team`, or `agency`. Valid intents are `blog`, `portfolio`, `marketing`, `docs`, `company`. Requires Clerk JWT.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "user_type": "solo",
    "intents": ["blog", "portfolio"]
  }' \
  https://your-domain.com/api/v1/auth/onboarding/complete
```

**Response** `200 OK` -- Returns the updated `OnboardingResponse`.

## Manage Clerk Users

List and manage Clerk users for member assignment. Requires Admin role on at least one site or system admin status. Responses include `moderation_status` (`active`, `suspended`, or `banned`) and `moderation_reason` (if applicable).

```bash
curl -H "Authorization: Bearer eyJ..." \
  "https://your-domain.com/api/v1/clerk/users?limit=20&offset=0"
```

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "user_2abc123",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "image_url": "https://img.clerk.com/abc123",
      "role": "admin",
      "created_at": 1704067200,
      "updated_at": 1717200000,
      "last_sign_in_at": 1717200000,
      "moderation_status": "active",
      "moderation_reason": null
    }
  ],
  "total_count": 42
}
```

## User Moderation

All moderation endpoints require system admin status. Moderation follows a deliberate escalation path: **active → suspended → banned → deleted**. Banned users cannot be unsuspended -- they can only be deleted.

### Suspend a User

Temporarily suspends a user for a specified duration. The user receives a 403 error with `ACCOUNT_SUSPENDED` on any API call while suspended. Expired suspensions auto-lift on the next request.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Repeated spam in blog comments",
    "duration_hours": 72
  }' \
  https://your-domain.com/api/v1/admin/users/user_2abc123/suspend
```

**Response** `200 OK`

```json
{
  "clerk_user_id": "user_2abc123",
  "status": "suspended",
  "reason": "Repeated spam in blog comments",
  "expires_at": "2026-03-22T23:50:00Z"
}
```

### Ban a User

Permanently bans a user. The user receives a 403 error with `ACCOUNT_BANNED` on any API call. A ban cannot be lifted via unsuspend -- the user must be deleted.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Terms of service violation"
  }' \
  https://your-domain.com/api/v1/admin/users/user_2abc123/ban
```

**Response** `200 OK`

```json
{
  "clerk_user_id": "user_2abc123",
  "status": "banned",
  "reason": "Terms of service violation",
  "expires_at": null
}
```

### Unsuspend a User

Lifts a suspension and restores the user to active status. Only works for suspended users -- returns 400 for banned users.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/admin/users/user_2abc123/unsuspend
```

**Response** `200 OK`

```json
{
  "clerk_user_id": "user_2abc123",
  "status": "active",
  "reason": null,
  "expires_at": null
}
```

### Delete a Banned User

Permanently deletes a banned user and all associated data. This action:

1. Removes all site memberships (user loses access to all sites)
2. Nullifies `created_by` on any content authored by the user
3. Deletes the moderation record
4. Deletes the Clerk account

Only works for banned users -- returns 400 for active or suspended users. **This action is irreversible.**

```bash
curl -X DELETE \
  -H "Authorization: Bearer eyJ..." \
  https://your-domain.com/api/v1/admin/users/user_2abc123
```

**Response** `200 OK`

```json
{
  "clerk_user_id": "user_2abc123",
  "status": "deleted",
  "reason": null,
  "expires_at": null
}
```
