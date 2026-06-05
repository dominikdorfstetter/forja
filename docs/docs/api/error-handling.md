---
sidebar_position: 3
---

# Error Handling

All API errors are returned as JSON following the [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807) format. This provides a consistent, machine-readable structure for error responses.

## Error Response Format

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Validation error: name must not be empty",
  "errors": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | A URI reference identifying the error type. Typically `about:blank`. |
| `title` | string | A short, human-readable summary of the error class. |
| `status` | integer | The HTTP status code. |
| `detail` | string | A human-readable description specific to this occurrence. |
| `errors` | array | Optional list of field-level validation errors. |

## Common Error Responses

### 400 Bad Request

Returned when the request body fails validation or contains invalid data.

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Validation error: slug must contain only lowercase letters, numbers, and hyphens"
}
```

### 401 Unauthorized

Returned when no valid authentication credentials are provided.

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Missing or invalid API key"
}
```

### 403 Forbidden

Returned when the authenticated user lacks the required permission level.

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "Admin API key required to create sites"
}
```

### 404 Not Found

Returned when the requested resource does not exist.

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Site not found"
}
```

### 409 Conflict

Returned when a unique constraint is violated (e.g., duplicate slug or source path).

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "A redirect with source path '/old-page' already exists for this site"
}
```

### 422 Unprocessable Entity

Returned when the request is syntactically valid but semantically incorrect.

```json
{
  "type": "about:blank",
  "title": "Validation Error",
  "status": 422,
  "detail": "Invalid status: must be one of 'read', 'write', 'admin', 'master'"
}
```

## Handling Errors in Client Code

Check the HTTP status code first, then parse the JSON body for details:

```javascript
const response = await fetch('/api/v1/sites', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey,
  },
  body: JSON.stringify(data),
});

if (!response.ok) {
  const error = await response.json();
  console.error(`${error.title}: ${error.detail}`);
  // Handle specific status codes as needed
}
```
