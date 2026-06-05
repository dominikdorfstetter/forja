---
sidebar_position: 4
---

# Error Handling

The SDK provides a hierarchy of typed error classes so you can handle different failure scenarios precisely. All errors extend the base `ForjaError` class.

## Error Class Hierarchy

| Class | HTTP Status | Code | Description |
|-------|-------------|------|-------------|
| `ForjaError` | — | varies | Base error class |
| `ForjaAuthError` | 401 | `AUTH_ERROR` | Invalid or missing API key |
| `ForjaPermissionError` | 403 | `PERMISSION_ERROR` | API key lacks required permissions |
| `ForjaNotFoundError` | 404 | `NOT_FOUND` | Resource does not exist |
| `ForjaValidationError` | 422 | `VALIDATION_ERROR` | Request parameters are invalid |
| `ForjaRateLimitError` | 429 | `RATE_LIMIT` | Too many requests; includes `retryAfter` |
| `ForjaServerError` | 5xx | `SERVER_ERROR` | Server-side failure |
| `ForjaNetworkError` | — | `NETWORK_ERROR` | Connection failure (server unreachable) |

## Importing Error Classes

```typescript
import {
  ForjaError,
  ForjaAuthError,
  ForjaPermissionError,
  ForjaNotFoundError,
  ForjaRateLimitError,
  ForjaValidationError,
  ForjaServerError,
  ForjaNetworkError,
} from '@forjacms/client';
```

## The Null-Return Pattern

Methods that fetch a **single resource** by ID or slug return `null` instead of throwing on 404. This applies to:

- `forja.blogs.get(idOrSlug)`
- `forja.blogs.getBySlug(slug)`
- `forja.pages.getByRoute(route)`
- `forja.navigation.getMenu(id)`
- `forja.navigation.getMenuBySlug(slug)`
- `forja.navigation.getItem(id)`
- `forja.cv.getSkill(id)`
- `forja.cv.getSkillBySlug(slug)`
- `forja.legal.get(id)`
- `forja.legal.getBySlug(slug)`
- `forja.legal.getCookieConsent()`
- `forja.media.get(id)`

```typescript
const blog = await forja.blogs.getBySlug('nonexistent');
// blog is null, no error thrown

if (!blog) {
  // Handle missing content (e.g. show 404 page)
}
```

**List methods** and other operations throw errors on failure rather than returning null:

```typescript
try {
  // This throws on non-404 errors (auth, network, server)
  const blogs = await forja.blogs.listPublished();
} catch (error) {
  // Handle error
}
```

:::info
The null-return pattern only absorbs 404 errors. If a `.get()` method encounters a 401, 403, 429, 5xx, or network error, it still throws the corresponding typed error.
:::

## ForjaAuthError (401)

Thrown when the API key is missing, expired, or invalid.

```typescript
try {
  const blogs = await forja.blogs.listPublished();
} catch (error) {
  if (error instanceof ForjaAuthError) {
    console.error('Authentication failed:', error.message);
    // Check your API key configuration
  }
}
```

**Common causes:**
- API key is not set or is empty
- API key has been revoked in the admin dashboard
- API key has expired

## ForjaPermissionError (403)

Thrown when the API key is valid but lacks the required permission level.

```typescript
try {
  await forja.analytics.trackPageview({ path: '/test' });
} catch (error) {
  if (error instanceof ForjaPermissionError) {
    console.error('Insufficient permissions:', error.message);
    // Ensure the API key has the required permission level
  }
}
```

## ForjaNotFoundError (404)

Thrown for 404 responses on list endpoints. Single-resource `.get()` methods return `null` instead.

```typescript
try {
  const items = await forja.navigation.listItems('nonexistent-menu-id');
} catch (error) {
  if (error instanceof ForjaNotFoundError) {
    console.error('Menu not found:', error.message);
  }
}
```

## ForjaRateLimitError (429)

Thrown when the API rate limit is exceeded. Includes the `retryAfter` property (in seconds) when the server provides a `Retry-After` header.

```typescript
try {
  const blogs = await forja.blogs.listPublished();
} catch (error) {
  if (error instanceof ForjaRateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter, 'seconds');
  }
}
```

### Retry Pattern

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ForjaRateLimitError && attempt < maxRetries) {
        const delay = (error.retryAfter ?? 1) * 1000;
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Unreachable');
}

// Usage
const blogs = await withRetry(() => forja.blogs.listPublished());
```

## ForjaValidationError (422)

Thrown when request parameters fail server-side validation. The `details` property may contain additional information about which fields are invalid.

```typescript
try {
  const report = await forja.analytics.getReport({ days: -1 });
} catch (error) {
  if (error instanceof ForjaValidationError) {
    console.error('Validation failed:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}
```

## ForjaServerError (5xx)

Thrown for any server-side error (500, 502, 503, etc.). The `status` property contains the HTTP status code.

```typescript
try {
  const site = await forja.site.get();
} catch (error) {
  if (error instanceof ForjaServerError) {
    console.error(`Server error (${error.status}):`, error.message);
  }
}
```

## ForjaNetworkError

Thrown when the HTTP request itself fails (e.g. DNS resolution failure, connection refused, timeout). The `cause` property contains the underlying error.

```typescript
try {
  const site = await forja.site.get();
} catch (error) {
  if (error instanceof ForjaNetworkError) {
    console.error('Network failure:', error.message);
    if (error.cause) {
      console.error('Underlying error:', error.cause.message);
    }
  }
}
```

## Comprehensive Error Handler

Here is a pattern for handling all error types in a single catch block:

```typescript
import {
  ForjaAuthError,
  ForjaPermissionError,
  ForjaRateLimitError,
  ForjaValidationError,
  ForjaServerError,
  ForjaNetworkError,
  ForjaError,
} from '@forjacms/client';

async function fetchBlogs() {
  try {
    return await forja.blogs.listPublished({ page: 1 });
  } catch (error) {
    if (error instanceof ForjaAuthError) {
      // 401 — redirect to login or check API key
      throw new Error('CMS authentication failed');
    }

    if (error instanceof ForjaPermissionError) {
      // 403 — API key lacks permissions
      throw new Error('CMS access denied');
    }

    if (error instanceof ForjaRateLimitError) {
      // 429 — back off and retry
      const delay = (error.retryAfter ?? 5) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return await forja.blogs.listPublished({ page: 1 });
    }

    if (error instanceof ForjaValidationError) {
      // 422 — fix request parameters
      throw new Error(`Invalid request: ${error.message}`);
    }

    if (error instanceof ForjaServerError) {
      // 5xx — CMS is having issues
      console.error(`CMS server error (${error.status})`);
      return null;
    }

    if (error instanceof ForjaNetworkError) {
      // Network failure — CMS is unreachable
      console.error('Cannot reach CMS:', error.message);
      return null;
    }

    // Unknown error
    throw error;
  }
}
```

:::tip Error Properties
All error classes extend `ForjaError`, which provides a `code` string property (e.g. `'AUTH_ERROR'`, `'RATE_LIMIT'`). You can use this for logging or error tracking:

```typescript
if (error instanceof ForjaError) {
  logger.error({ code: error.code, message: error.message });
}
```
:::
