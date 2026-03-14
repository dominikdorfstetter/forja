---
sidebar_position: 21
---

# Federation

Admin API endpoints for managing ActivityPub federation. Protocol endpoints (WebFinger, actor, inbox) are internal and not documented here.

:::info
Federation is a **site module**. All endpoints below (except `enable` and `disable`) require the federation module to be enabled for the site, or they return `403 Forbidden`.
:::

## Endpoints

### Settings

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/settings` | Reviewer | Get federation settings |
| PUT | `/sites/{site_id}/federation/settings` | Admin | Update federation settings |
| POST | `/sites/{site_id}/federation/enable` | Owner | Enable federation (generates keypair) |
| POST | `/sites/{site_id}/federation/disable` | Owner | Disable federation |
| POST | `/sites/{site_id}/federation/rotate-keys` | Owner | Rotate signing keys |

### Stats

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/stats` | Reviewer | Get federation statistics |

### Followers

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/followers?page&page_size` | Reviewer | List followers (paginated) |
| DELETE | `/sites/{site_id}/federation/followers/{follower_id}` | Admin | Remove a follower |

### Activities

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/activities?page&page_size&direction&status` | Reviewer | List activities (paginated, filterable) |
| POST | `/sites/{site_id}/federation/activities/{activity_id}/retry` | Admin | Retry a failed delivery |
| GET | `/sites/{site_id}/federation/engagement/{content_id}` | Reviewer | Get engagement counts for a content item |

### Comments

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/comments?page&page_size&status` | Reviewer | List comments (paginated, filterable) |
| PUT | `/sites/{site_id}/federation/comments/{comment_id}/approve` | Reviewer | Approve a comment |
| PUT | `/sites/{site_id}/federation/comments/{comment_id}/reject` | Reviewer | Reject a comment |
| DELETE | `/sites/{site_id}/federation/comments/{comment_id}` | Admin | Delete a comment |

### Blocks

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/blocks/instances` | Admin | List blocked instances |
| POST | `/sites/{site_id}/federation/blocks/instances` | Admin | Block an instance domain |
| POST | `/sites/{site_id}/federation/blocks/instances/import` | Admin | Bulk-import blocked domains |
| DELETE | `/sites/{site_id}/federation/blocks/instances/{domain}` | Admin | Unblock an instance |
| GET | `/sites/{site_id}/federation/blocks/actors` | Admin | List blocked actors |
| POST | `/sites/{site_id}/federation/blocks/actors` | Admin | Block a remote actor |
| DELETE | `/sites/{site_id}/federation/blocks/actors/{actor_uri}` | Admin | Unblock a remote actor |

### Health

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/health` | Admin | Get delivery health per remote instance |

### Notes (Quick Posts)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/notes?page&page_size` | Reviewer | List notes (paginated) |
| POST | `/sites/{site_id}/federation/notes` | Reviewer | Create a note |
| PUT | `/sites/{site_id}/federation/notes/{note_id}` | Reviewer | Update a note |
| DELETE | `/sites/{site_id}/federation/notes/{note_id}` | Admin | Delete a note |

### Featured Posts (Pinned)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/federation/featured` | Admin | List pinned posts |
| POST | `/sites/{site_id}/federation/featured` | Admin | Pin a blog post (max 3) |
| DELETE | `/sites/{site_id}/federation/featured/{content_id}` | Admin | Unpin a blog post |

## Get Federation Settings

Returns the current federation configuration for a site, including the actor URI and WebFinger address when federation is enabled.

```bash
curl https://your-site.com/api/v1/sites/{site_id}/federation/settings \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK`

```json
{
  "enabled": true,
  "signature_algorithm": "rsa-sha256",
  "moderation_mode": "manual",
  "auto_publish": false,
  "actor_uri": "https://example.com/ap/blog/actor",
  "webfinger_address": "blog@example.com",
  "summary": "A blog about web development",
  "avatar_url": "https://example.com/avatar.png"
}
```

## Update Federation Settings

Updates one or more federation settings. All fields are optional -- only provided fields are changed.

```bash
curl -X PUT https://your-site.com/api/v1/sites/{site_id}/federation/settings \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "moderation_mode": "auto_approve",
    "auto_publish": true,
    "summary": "My tech blog"
  }'
```

**Request Body**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `signature_algorithm` | string | `rsa-sha256` or `ed25519` | Signing algorithm for HTTP signatures |
| `moderation_mode` | string | `manual` or `auto_approve` | Comment moderation mode |
| `auto_publish` | boolean | | Auto-syndicate published blog posts |
| `summary` | string | max 500 chars | Actor bio for Fediverse profiles |
| `avatar_url` | string | max 500 chars | Actor avatar URL |

**Response** -- `200 OK` with the updated settings.

## Enable Federation

Generates RSA keypairs, creates the ActivityPub actor, and enables the federation module for a site. Requires Owner role.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/enable \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK` with the federation settings. Returns `409` if federation is already enabled.

## Disable Federation

Disables the federation module. Actor data is preserved so it can be re-enabled later.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/disable \
  -H "X-API-Key: your_api_key"
```

**Response** -- `204 No Content`

## Rotate Keys

Generates new signing keys for the site's ActivityPub actor. The old actor is replaced with a new one using fresh keys.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/rotate-keys \
  -H "X-API-Key: your_api_key"
```

**Response** -- `204 No Content`

## List Followers

Returns a paginated list of remote followers for the site.

```bash
curl "https://your-site.com/api/v1/sites/{site_id}/federation/followers?page=1&page_size=20" \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK` with `data` and `meta` pagination fields.

## Create a Note

Posts a short-form Note to the Fediverse. Optionally schedule it for future publication.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/notes \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Hello from Forja!",
    "scheduled_at": "2026-04-01T12:00:00Z"
  }'
```

**Request Body**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `body` | string | Yes | 1 -- 500 chars | Plain-text note body |
| `scheduled_at` | string | No | ISO 8601 datetime | Schedule for future publication |

**Response** -- `201 Created`

## Update a Note

Updates the body of a published note and sends an Update activity to all followers so remote servers reflect the change.

```bash
curl -X PUT https://your-site.com/api/v1/sites/{site_id}/federation/notes/{note_id} \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Updated text"
  }'
```

**Request Body**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `body` | string | Yes | 1 -- 500 chars | Updated plain-text note body |

**Response** -- `200 OK` with the updated note.

## Moderate Comments

Approve or reject inbound federated comments.

```bash
# Approve
curl -X PUT https://your-site.com/api/v1/sites/{site_id}/federation/comments/{comment_id}/approve \
  -H "X-API-Key: your_api_key"

# Reject
curl -X PUT https://your-site.com/api/v1/sites/{site_id}/federation/comments/{comment_id}/reject \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK` with the updated comment.

## Block an Instance

Block all interactions from a remote instance domain.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/blocks/instances \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "spam.example.com",
    "reason": "Known spam instance"
  }'
```

**Response** -- `200 OK` with the blocked instance record.

## Import Blocklist

Bulk-import blocked domains in a single request. Existing entries are detected and skipped so the operation is safe to re-run with overlapping lists.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/blocks/instances/import \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["spam.example.com", "abuse.example.org"]
  }'
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domains` | string[] | Yes | List of domain names to block |

**Response** -- `200 OK`

```json
{ "imported": 5, "skipped": 2 }
```

## Instance Health

Returns delivery statistics grouped by remote instance. Use this to identify consistently failing servers.

```bash
curl "https://your-site.com/api/v1/sites/{site_id}/federation/health" \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK`

Array of objects, one per remote instance:

| Field | Type | Description |
|-------|------|-------------|
| `instance_domain` | string | Remote instance hostname |
| `total` | integer | Total delivery attempts |
| `successful` | integer | Successful deliveries |
| `failed` | integer | Failed deliveries (non-terminal) |
| `dead` | integer | Dead-lettered deliveries (all retries exhausted) |
| `last_attempt` | string | ISO 8601 timestamp of the most recent attempt |

## Pin a Blog Post

Pin a blog post to the ActivityPub featured collection. Maximum 3 pinned posts.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/federation/featured \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "content_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

**Response** -- `201 Created`. Returns `409` if the maximum number of pinned posts is reached.
