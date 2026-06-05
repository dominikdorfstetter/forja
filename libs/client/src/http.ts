import {
  ForjaAuthError,
  ForjaNetworkError,
  ForjaNotFoundError,
  ForjaPermissionError,
  ForjaRateLimitError,
  ForjaServerError,
  ForjaValidationError,
} from './errors.js';
import type { ForjaClientConfig, Paginated, PaginationMeta } from './types.js';

/**
 * Low-level HTTP client interface used by all resource classes.
 *
 * Handles authentication (X-API-Key header), JSON serialization, and
 * error mapping. You don't interact with this directly — use
 * {@link ForjaClient} instead.
 */
export interface HttpClient {
  /** Send a GET request. Query params with `undefined` values are omitted. */
  get<T>(path: string, params?: Record<string, string | undefined>): Promise<T>;
  /**
   * Send a GET request, resolving to `null` when the resource is not found
   * (HTTP 404 / {@link ForjaNotFoundError}) instead of throwing. Every other
   * error (auth, validation, server, network) still propagates.
   *
   * Centralizes the `404 -> null` discrimination that single-resource lookups
   * need, so resource methods don't each hand-roll a try/catch.
   */
  getOrNull<T>(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<T | null>;
  /** Send a GET request and return the response as plain text (for XML, HTML, etc.). */
  getText(path: string, params?: Record<string, string | undefined>): Promise<string>;
  /** Send a POST request with a JSON body. */
  post<T>(path: string, body?: unknown): Promise<T>;
  /** Send a DELETE request. Resolves on any 2xx; throws on 4xx/5xx. */
  delete(path: string): Promise<void>;
}

/**
 * Build a full URL from a base URL, path, and optional query parameters.
 * Undefined parameter values are silently skipped.
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | undefined>,
): string {
  const base = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

/**
 * Convert a camelCase options object to snake_case query parameters.
 *
 * - `undefined` and `null` values are omitted
 * - All values are stringified
 * - Keys are converted: `pageSize` becomes `page_size`
 */
export function toQueryParams(
  obj: object,
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined && value !== null) {
      params[camelToSnake(key)] = String(value);
    }
  }
  return params;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

async function mapResponseError(response: Response): Promise<never> {
  let message: string;
  try {
    const body = await response.json();
    message = body.detail || body.message || body.title || response.statusText;
  } catch {
    message = response.statusText;
  }

  switch (response.status) {
    case 401:
      throw new ForjaAuthError(message);
    case 403:
      throw new ForjaPermissionError(message);
    case 404:
      throw new ForjaNotFoundError(message);
    case 422:
      throw new ForjaValidationError(message);
    case 429: {
      const retryAfter = response.headers.get('retry-after');
      throw new ForjaRateLimitError(
        message,
        retryAfter ? parseInt(retryAfter, 10) : undefined,
      );
    }
    default:
      if (response.status >= 500) {
        throw new ForjaServerError(message, response.status);
      }
      throw new ForjaServerError(message, response.status);
  }
}

/**
 * Create an {@link HttpClient} configured with the given API base URL and key.
 *
 * Every request includes:
 * - `X-API-Key` header for authentication
 * - `Content-Type: application/json`
 *
 * Non-2xx responses are mapped to typed errors:
 * - 401 -> {@link ForjaAuthError}
 * - 403 -> {@link ForjaPermissionError}
 * - 404 -> {@link ForjaNotFoundError}
 * - 422 -> {@link ForjaValidationError}
 * - 429 -> {@link ForjaRateLimitError}
 * - 5xx -> {@link ForjaServerError}
 * - Network failure -> {@link ForjaNetworkError}
 */
export function createHttpClient(config: ForjaClientConfig): HttpClient {
  const fetchFn = config.fetch ?? globalThis.fetch;
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  const headers: Record<string, string> = {
    'X-API-Key': config.apiKey,
    'Content-Type': 'application/json',
  };
  if (config.siteDomain) {
    headers['X-Site-Domain'] = config.siteDomain;
  }

  async function rawRequest(
    method: string,
    path: string,
    params?: Record<string, string | undefined>,
    body?: unknown,
  ): Promise<Response> {
    const url = buildUrl(baseUrl, path, params);

    let response: Response;
    try {
      response = await fetchFn(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new ForjaNetworkError(
        'Failed to connect to the Forja API',
        error instanceof Error ? error : undefined,
      );
    }

    if (!response.ok) {
      return mapResponseError(response);
    }

    return response;
  }

  function get<T>(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<T> {
    return rawRequest('GET', path, params).then((r) => r.json() as Promise<T>);
  }

  async function getOrNull<T>(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<T | null> {
    try {
      return await get<T>(path, params);
    } catch (error) {
      if (error instanceof ForjaNotFoundError) return null;
      throw error;
    }
  }

  return {
    get,
    getOrNull,
    getText: (path: string, params?: Record<string, string | undefined>) =>
      rawRequest('GET', path, params).then((r) => r.text()),
    post: <T>(path: string, body?: unknown) =>
      rawRequest('POST', path, undefined, body).then((r) => r.json() as Promise<T>),
    delete: (path: string) => rawRequest('DELETE', path).then(() => undefined),
  };
}

/**
 * A paginated API response enriched with navigation helpers.
 *
 * Extends the raw {@link Paginated} response with methods to fetch
 * subsequent pages or collect all items.
 *
 * @typeParam T - The type of items in the paginated collection.
 *
 * @example
 * ```ts
 * const page1 = await forja.blogs.listPublished({ pageSize: 10 });
 *
 * // Navigate to next page
 * const page2 = await page1.fetchNext();
 *
 * // Or collect everything
 * const allBlogs = await page1.fetchAll();
 *
 * // Or iterate page by page
 * for await (const page of page1) {
 *   console.log(page.data);
 * }
 * ```
 */
export interface PaginatedResult<T> extends Paginated<T> {
  /** Fetch the next page. Returns `null` if this is the last page. */
  fetchNext(): Promise<PaginatedResult<T> | null>;
  /** Fetch all remaining pages and return every item as a flat array. */
  fetchAll(): Promise<T[]>;
  /** Async iterator that yields each page (including the current one). */
  [Symbol.asyncIterator](): AsyncIterableIterator<Paginated<T>>;
}

/**
 * Wrap raw paginated data with navigation helpers.
 * @internal
 */
export function createPaginatedResult<T>(
  data: T[],
  meta: PaginationMeta,
  fetchPage: (page: number) => Promise<Paginated<T>>,
): PaginatedResult<T> {
  return {
    data,
    meta,

    async fetchNext(): Promise<PaginatedResult<T> | null> {
      if (meta.page >= meta.total_pages) return null;
      const next = await fetchPage(meta.page + 1);
      return createPaginatedResult(next.data, next.meta, fetchPage);
    },

    async fetchAll(): Promise<T[]> {
      const all = [...data];
      let currentPage = meta.page;

      while (currentPage < meta.total_pages) {
        currentPage++;
        const next = await fetchPage(currentPage);
        all.push(...next.data);
      }

      return all;
    },

    async *[Symbol.asyncIterator](): AsyncIterableIterator<Paginated<T>> {
      yield { data, meta };
      let currentPage = meta.page;

      while (currentPage < meta.total_pages) {
        currentPage++;
        const next = await fetchPage(currentPage);
        yield next;
      }
    },
  };
}
