---
sidebar_position: 18
---

# System

System endpoints provide health checks, version information, and public configuration. These endpoints do not require authentication.

## Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/` | No | API index -- returns version string |
| GET | `/health` | No | Health check with service status |
| GET | `/config` | No | Public frontend configuration |
| GET | `/imprint` | No | Public operator imprint (Impressum) |
| GET | `/error-codes` | No | Error code catalog |

## API Index

Returns a simple version string.

```bash
curl https://your-domain.com/api/v1/
```

**Response** `200 OK`

```
Forja API v0.1.0
```

## Health Check

Returns a structured health report for all backend services: database, Redis cache, Clerk IDP, and storage backend. Includes latency measurements for each service.

```bash
curl https://your-domain.com/api/v1/health
```

**Response** `200 OK`

```json
{
  "status": "healthy",
  "services": [
    {
      "name": "database",
      "status": "up",
      "latency_ms": 2,
      "error": null
    },
    {
      "name": "redis (cache)",
      "status": "up",
      "latency_ms": 1,
      "error": null
    },
    {
      "name": "clerk (idp)",
      "status": "up",
      "latency_ms": 45,
      "error": null
    }
  ],
  "storage": {
    "name": "storage (local)",
    "status": "up",
    "latency_ms": 0,
    "provider": "local",
    "total_bytes": 107374182400,
    "available_bytes": 53687091200,
    "used_percent": 50.0
  }
}
```

### Status Values

| Status | HTTP Code | Meaning |
|--------|-----------|---------|
| `healthy` | 200 | All services are up |
| `degraded` | 200 | Database is up but optional services (Redis, Clerk, storage) are down |
| `unhealthy` | 503 | Database is down |

### Service Status Values

- `up` -- Service is operational
- `down` -- Service is unreachable
- `disabled` -- Service is not configured

## Public Configuration

Returns runtime configuration for the admin dashboard frontend. This is the only way the frontend discovers the Clerk publishable key without bundling it.

```bash
curl https://your-domain.com/api/v1/config
```

**Response** `200 OK`

```json
{
  "clerk_publishable_key": "pk_live_abc123...",
  "app_name": "Forja"
}
```

## Imprint

Returns the deployment operator's imprint (Impressum) details, sourced entirely from `IMPRINT_*` environment variables at runtime (see [Environment Variables](../../deployment/environment-variables)). The admin SPA is pre-built and shipped in the Docker image, so per-operator legal details are served here rather than baked in at build time. No authentication required.

```bash
curl https://your-domain.com/api/v1/imprint
```

**Response** `200 OK` — when the required fields (`IMPRINT_OPERATOR_NAME`, `IMPRINT_ADDRESS`, `IMPRINT_EMAIL`) are all set:

```json
{
  "configured": true,
  "operator_name": "Acme GmbH",
  "address": "Hauptstraße 1, 1010 Wien, Austria",
  "email": "legal@acme.example",
  "vat": "ATU12345678"
}
```

Only fields the operator set are serialized. Values are returned verbatim as plain JSON strings (never interpreted as HTML).

**Response** `200 OK` — when the required fields are not all set:

```json
{ "configured": false }
```

The Welcome page hides its footer Imprint link whenever `configured` is `false`. If some — but not all — required fields are present, the endpoint still returns `{ "configured": false }` and logs a single `ERR_IMPRINT_INCOMPLETE` warning so the operator can spot the misconfiguration.

## Error Code Catalog

Returns the full catalog of machine-readable error codes used by the API. Each entry includes the code, its domain, the HTTP status it typically produces, and a human-readable description. This endpoint does not require authentication.

```bash
curl https://your-domain.com/api/v1/error-codes
```

**Response** `200 OK`

```json
{
  "total": 42,
  "codes": [
    {
      "code": "BLOG_NOT_FOUND",
      "domain": "blog",
      "http_status": 404,
      "description": "The requested blog post does not exist"
    },
    {
      "code": "SITE_SLUG_TAKEN",
      "domain": "site",
      "http_status": 409,
      "description": "A site with this slug already exists"
    }
  ]
}
```
