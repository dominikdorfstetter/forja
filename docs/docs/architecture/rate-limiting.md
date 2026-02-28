---
title: Rate Limiting
sidebar_position: 7
description: Redis-backed rate limiting with per-IP and per-key tracking.
---

# Rate Limiting

OpenYapper uses **Redis-backed fixed-window counters** for rate limiting. Rate limiting operates at two levels: per-IP (global) and per-API-key (individual). If Redis is unavailable, the system degrades gracefully and allows all requests through.

## How It Works

Rate limiting is enforced inside the authentication guard, after the API key or JWT has been validated but before the handler runs. The flow is:

```
Request authenticated
        │
        ▼
┌───────────────────┐
│ Redis available?  │──── No ────▶ Skip rate limiting (fail-open)
└───────┬───────────┘
        │ Yes
        ▼
┌───────────────────┐
│ IP is loopback?   │──── Yes ───▶ Skip IP rate limit
│ (127.0.0.1/::1)   │
└───────┬───────────┘
        │ No
        ▼
┌───────────────────┐
│ Check IP-based    │──── Exceeded? ────▶ 429 Too Many Requests
│ rate limit        │
└───────┬───────────┘
        │ OK
        ▼
┌───────────────────┐
│ Check per-key     │──── Exceeded? ────▶ 429 Too Many Requests
│ rate limit        │
└───────┬───────────┘
        │ OK
        ▼
   Handler executes
```

## Fixed-Window Counters

Each rate limit window is tracked with a Redis key following the pattern:

```
rl:<identifier>:<window>:<window_id>
```

Where:
- `<identifier>` is `ip:<address>` or `key:<uuid>`
- `<window>` is `s` (second), `m` (minute), `h` (hour), or `d` (day)
- `<window_id>` is `now / window_duration` (epoch-based window number)

For example, a per-minute counter for IP `192.168.1.100` at timestamp 1709136060:

```
rl:ip:192.168.1.100:m:28485601
```

### Counting Logic

1. **INCR** the Redis key (atomic increment, returns new count).
2. If the count is `1` (first request in window), **EXPIRE** the key with the window duration as TTL.
3. If the count exceeds the limit, return `429 Too Many Requests`.
4. If Redis returns an error at any step, log a warning and **allow the request** (fail-open).

This approach is simple, atomic (INCR is a single Redis command), and self-cleaning (keys expire automatically).

## IP-Based Rate Limiting

Global rate limits apply to all requests from a given IP address, regardless of which API key is used. These limits are configured at the application level.

### Default Limits

| Window | Default Limit | Environment Variable |
|--------|--------------|---------------------|
| Per second | 50 | `APP__SECURITY__RATE_LIMIT_PER_SECOND` |
| Per minute | 500 | `APP__SECURITY__RATE_LIMIT_PER_MINUTE` |

### Exemptions

Loopback addresses (`127.0.0.1`, `::1`, `localhost`) are exempt from IP-based rate limiting. This prevents development environments from being throttled.

## Per-Key Rate Limiting

Individual API keys can have custom rate limits configured in the `api_keys` table:

| Field | Purpose |
|-------|---------|
| `rate_limit_per_second` | Max requests per second for this key |
| `rate_limit_per_minute` | Max requests per minute for this key |
| `rate_limit_per_hour` | Max requests per hour for this key |
| `rate_limit_per_day` | Max requests per day for this key |

All four fields are optional. If a field is `NULL` or `0`, that window is not enforced for the key.

Per-key limits are checked after global IP limits. Both must pass for the request to proceed.

## Response Headers

Every response includes rate limit headers (when Redis is available):

```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 42
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | The limit for the most restrictive applicable window |
| `X-RateLimit-Remaining` | Remaining requests in that window |
| `X-RateLimit-Reset` | Seconds until the window resets |

The "most restrictive" window is determined by whichever window has the lowest remaining-to-limit ratio. This ensures clients see the most relevant throttling information.

### Implementation Detail

Rate limit header values are stored in Rocket's request-local cache using atomic integers (`AtomicU32` / `AtomicU64`). This allows the auth guard to update the values after creation, and the response fairing reads them when constructing the response.

```rust
pub struct RateLimitHeaderInfo {
    pub limit: AtomicU32,
    pub remaining: AtomicU32,
    pub reset: AtomicU64,
}
```

## Error Response

When a rate limit is exceeded, the API returns a `429 Too Many Requests` response with an RFC 7807 Problem Details body:

```json
{
  "type": "https://openyapper.dev/errors/rate_limited",
  "title": "Rate Limited",
  "status": 429,
  "detail": "Rate limit exceeded: 51 requests per second exceeded (limit: 50)",
  "code": "RATE_LIMITED"
}
```

## Graceful Degradation

Rate limiting is designed to be non-critical. If Redis is unavailable:

- **At startup**: The application logs a warning and starts without rate limiting.
- **During operation**: If a Redis command fails, the request is allowed through and a warning is logged.
- **No data loss**: Rate limits are ephemeral counters, so Redis restarts simply reset all windows.

This fail-open approach ensures that a Redis outage does not cause a service-wide outage.

## Configuration Summary

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `REDIS_URL` | Redis connection string | `redis://127.0.0.1:6379` |
| `APP__SECURITY__RATE_LIMIT_PER_SECOND` | Global per-IP requests/second | `50` |
| `APP__SECURITY__RATE_LIMIT_PER_MINUTE` | Global per-IP requests/minute | `500` |
| `APP__SECURITY__RATE_LIMIT_BURST` | Burst size (max concurrent) | `20` |
