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

## API Index

Returns a simple version string.

```bash
curl https://your-domain.com/api/v1/
```

**Response** `200 OK`

```
OpenYapper API v0.1.0
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
  "app_name": "OpenYapper"
}
```
