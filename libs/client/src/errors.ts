/**
 * Base error class for all Forja SDK errors.
 *
 * Every error includes a machine-readable {@link code} following the pattern
 * `AUTH_ERROR`, `NOT_FOUND`, `RATE_LIMIT`, etc. for programmatic handling.
 */
export class ForjaError extends Error {
  constructor(
    message: string,
    /** Machine-readable error code (e.g. `AUTH_ERROR`, `NOT_FOUND`). */
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ForjaError';
  }
}

/**
 * Thrown when the API returns HTTP 401 — the API key is invalid, expired, or missing.
 *
 * @example
 * ```ts
 * try {
 *   await forja.blogs.listPublished();
 * } catch (err) {
 *   if (err instanceof ForjaAuthError) {
 *     console.error('Check your API key');
 *   }
 * }
 * ```
 */
export class ForjaAuthError extends ForjaError {
  constructor(message = 'Invalid or missing API key') {
    super(message, 'AUTH_ERROR');
    this.name = 'ForjaAuthError';
  }
}

/**
 * Thrown when the API returns HTTP 403 — the API key lacks the required permission
 * level for the requested operation (e.g. a `Read` key trying to write).
 */
export class ForjaPermissionError extends ForjaError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'PERMISSION_ERROR');
    this.name = 'ForjaPermissionError';
  }
}

/**
 * Thrown when the API returns HTTP 404 — the requested resource does not exist.
 *
 * Single-resource methods (e.g. `blogs.get()`, `media.get()`) catch this
 * internally and return `null` instead. This error only surfaces if you call
 * an endpoint that doesn't use the null-return pattern.
 */
export class ForjaNotFoundError extends ForjaError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND');
    this.name = 'ForjaNotFoundError';
  }
}

/**
 * Thrown when the API returns HTTP 429 — the client has exceeded the rate limit.
 *
 * The {@link retryAfter} property contains the number of seconds to wait before
 * retrying, parsed from the `Retry-After` response header (if present).
 *
 * @example
 * ```ts
 * try {
 *   await forja.blogs.listPublished();
 * } catch (err) {
 *   if (err instanceof ForjaRateLimitError) {
 *     await sleep(err.retryAfter ?? 5);
 *     // retry...
 *   }
 * }
 * ```
 */
export class ForjaRateLimitError extends ForjaError {
  constructor(
    message = 'Rate limit exceeded',
    /** Seconds to wait before retrying, from the `Retry-After` header. */
    public readonly retryAfter?: number,
  ) {
    super(message, 'RATE_LIMIT');
    this.name = 'ForjaRateLimitError';
  }
}

/**
 * Thrown when the API returns HTTP 422 — the request body failed validation
 * (e.g. missing required fields, invalid format).
 */
export class ForjaValidationError extends ForjaError {
  constructor(
    message = 'Validation error',
    /** Additional validation details from the API response. */
    public readonly details?: string,
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ForjaValidationError';
  }
}

/**
 * Thrown when the API returns HTTP 5xx — an unexpected server-side failure.
 *
 * The {@link status} property contains the exact HTTP status code (500, 502, 503, etc.).
 */
export class ForjaServerError extends ForjaError {
  constructor(
    message = 'Internal server error',
    /** The HTTP status code (e.g. 500, 502, 503). */
    public readonly status: number = 500,
  ) {
    super(message, 'SERVER_ERROR');
    this.name = 'ForjaServerError';
  }
}

/**
 * Thrown when the HTTP request fails at the network level — the server is
 * unreachable, DNS resolution failed, or the connection was reset.
 *
 * The original error is available via {@link cause}.
 */
export class ForjaNetworkError extends ForjaError {
  constructor(
    message = 'Network error',
    /** The underlying network error (e.g. `TypeError: Failed to fetch`). */
    public readonly cause?: Error,
  ) {
    super(message, 'NETWORK_ERROR');
    this.name = 'ForjaNetworkError';
  }
}
