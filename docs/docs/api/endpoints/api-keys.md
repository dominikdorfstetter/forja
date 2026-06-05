---
sidebar_position: 14
---

# API Keys

Manage API keys for programmatic access to the CMS. API keys are scoped to a site and have a permission level. Site admins can manage keys for their sites; system admins can manage all keys.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api-keys?status&permission&site_id&page&per_page` | Admin | List API keys (paginated, filterable) |
| GET | `/api-keys/{id}` | Admin | Get an API key by ID |
| POST | `/api-keys` | Admin | Create a new API key |
| PUT | `/api-keys/{id}` | Admin | Update an API key |
| DELETE | `/api-keys/{id}` | Admin | Permanently delete an API key |
| POST | `/api-keys/{id}/block` | Admin | Block an API key |
| POST | `/api-keys/{id}/unblock` | Admin | Unblock a blocked API key |
| POST | `/api-keys/{id}/revoke` | Admin | Permanently revoke an API key |
| GET | `/api-keys/{id}/usage?limit&offset` | Admin | Get usage history |

## Permission Capping

The permission level of a new API key is capped by the creator's role:

| Creator Role | Maximum Key Permission |
|-------------|----------------------|
| System Admin | Master |
| Site Owner | Admin |
| Site Admin | Write |
| Other roles | Read |

## Create an API Key

The plaintext key is returned only once in the creation response. Store it securely.

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "description": "Used by GitHub Actions for content deployment",
    "permission": "Write",
    "site_id": "site-uuid",
    "rate_limit_per_minute": 60
  }' \
  https://your-domain.com/api/v1/api-keys
```

**Response** `200 OK`

```json
{
  "id": "key-uuid",
  "key": "oy_live_aBcDeFgHiJkLmNoPqRsTuVwXyZ...",
  "key_prefix": "oy_live_aBcD",
  "name": "CI/CD Pipeline",
  "permission": "Write",
  "site_id": "site-uuid",
  "status": "Active",
  "rate_limit_per_minute": 60,
  "created_at": "2025-01-15T12:00:00Z"
}
```

## Key Lifecycle

API keys have the following statuses:

- **Active** -- Key is functional and can authenticate requests.
- **Blocked** -- Key is temporarily disabled. Can be unblocked.
- **Revoked** -- Key is permanently disabled. Cannot be undone.
- **Expired** -- Key has passed its `expires_at` timestamp.

## Block a Key

```bash
curl -X POST \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspected leak"}' \
  https://your-domain.com/api/v1/api-keys/{id}/block
```

## Usage History

```bash
curl -H "Authorization: Bearer eyJ..." \
  "https://your-domain.com/api/v1/api-keys/{id}/usage?limit=50&offset=0"
```
