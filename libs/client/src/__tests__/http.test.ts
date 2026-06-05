import { describe, expect, it, vi } from 'vitest';
import {
  buildUrl,
  createHttpClient,
  createPaginatedResult,
  toQueryParams,
} from '../http.js';
import {
  ForjaAuthError,
  ForjaNetworkError,
  ForjaNotFoundError,
  ForjaPermissionError,
  ForjaRateLimitError,
  ForjaServerError,
  ForjaValidationError,
} from '../errors.js';

describe('buildUrl', () => {
  it('joins base and path', () => {
    expect(buildUrl('https://api.example.com', '/blogs')).toBe(
      'https://api.example.com/blogs',
    );
  });

  it('strips trailing slashes from base', () => {
    expect(buildUrl('https://api.example.com/', '/blogs')).toBe(
      'https://api.example.com/blogs',
    );
  });

  it('adds leading slash if missing', () => {
    expect(buildUrl('https://api.example.com', 'blogs')).toBe(
      'https://api.example.com/blogs',
    );
  });

  it('appends query params', () => {
    const url = buildUrl('https://api.example.com', '/blogs', {
      page: '1',
      page_size: '10',
    });
    expect(url).toBe(
      'https://api.example.com/blogs?page=1&page_size=10',
    );
  });

  it('skips undefined params', () => {
    const url = buildUrl('https://api.example.com', '/blogs', {
      page: '1',
      search: undefined,
    });
    expect(url).toBe('https://api.example.com/blogs?page=1');
  });
});

describe('toQueryParams', () => {
  it('converts camelCase keys to snake_case', () => {
    expect(toQueryParams({ pageSize: 10, sortBy: 'name' })).toEqual({
      page_size: '10',
      sort_by: 'name',
    });
  });

  it('skips undefined and null values', () => {
    expect(toQueryParams({ page: 1, search: undefined })).toEqual({
      page: '1',
    });
  });

  it('stringifies values', () => {
    expect(toQueryParams({ page: 1, active: true })).toEqual({
      page: '1',
      active: 'true',
    });
  });
});

function mockFetch(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  });
}

describe('createHttpClient', () => {
  const config = {
    baseUrl: 'https://api.example.com/api/v1',
    apiKey: 'test-key',
    siteId: 'site-1',
  };

  it('sends GET requests with API key header', async () => {
    const fetch = mockFetch(200, { id: '1' });
    const http = createHttpClient({ ...config, fetch });

    const result = await http.get('/blogs/1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/blogs/1',
      {
        method: 'GET',
        headers: {
          'X-API-Key': 'test-key',
          'Content-Type': 'application/json',
        },
        body: undefined,
      },
    );
    expect(result).toEqual({ id: '1' });
  });

  it('sends GET requests with query params', async () => {
    const fetch = mockFetch(200, { data: [] });
    const http = createHttpClient({ ...config, fetch });

    await http.get('/blogs', { page: '1', page_size: '10' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/blogs?page=1&page_size=10',
      expect.any(Object),
    );
  });

  it('sends POST requests with JSON body', async () => {
    const fetch = mockFetch(201, { ok: true });
    const http = createHttpClient({ ...config, fetch });

    await http.post('/analytics/pageview', { path: '/blog' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/analytics/pageview',
      {
        method: 'POST',
        headers: expect.any(Object),
        body: JSON.stringify({ path: '/blog' }),
      },
    );
  });

  it('throws ForjaAuthError on 401', async () => {
    const fetch = mockFetch(401, { detail: 'Invalid API key' });
    const http = createHttpClient({ ...config, fetch });

    await expect(http.get('/blogs')).rejects.toThrow(ForjaAuthError);
  });

  it('throws ForjaPermissionError on 403', async () => {
    const fetch = mockFetch(403, { detail: 'Forbidden' });
    const http = createHttpClient({ ...config, fetch });

    await expect(http.get('/blogs')).rejects.toThrow(ForjaPermissionError);
  });

  it('throws ForjaNotFoundError on 404', async () => {
    const fetch = mockFetch(404, { detail: 'Not found' });
    const http = createHttpClient({ ...config, fetch });

    await expect(http.get('/blogs/999')).rejects.toThrow(ForjaNotFoundError);
  });

  it('throws ForjaValidationError on 422', async () => {
    const fetch = mockFetch(422, { detail: 'Invalid field' });
    const http = createHttpClient({ ...config, fetch });

    await expect(http.post('/blogs', {})).rejects.toThrow(
      ForjaValidationError,
    );
  });

  it('falls back to body.message then body.title when detail is missing', async () => {
    const fetch1 = mockFetch(404, { message: 'Lookup miss' });
    const http1 = createHttpClient({ ...config, fetch: fetch1 });
    try {
      await http1.get('/x');
    } catch (e) {
      expect((e as Error).message).toBe('Lookup miss');
    }

    const fetch2 = mockFetch(404, { title: 'Lookup title' });
    const http2 = createHttpClient({ ...config, fetch: fetch2 });
    try {
      await http2.get('/x');
    } catch (e) {
      expect((e as Error).message).toBe('Lookup title');
    }
  });

  it('falls back to statusText when the body has no detail/message/title', async () => {
    // Body parses successfully but is an empty object — all 3 keys absent.
    const fetch = mockFetch(404, {});
    const http = createHttpClient({ ...config, fetch });
    try {
      await http.get('/x');
    } catch (e) {
      expect((e as Error).message).toBe('Status 404');
    }
  });

  it('throws ForjaRateLimitError on 429 without retry-after header', async () => {
    const fetch = mockFetch(429, { detail: 'Rate limited' });
    const http = createHttpClient({ ...config, fetch });
    try {
      await http.get('/blogs');
    } catch (err) {
      expect(err).toBeInstanceOf(ForjaRateLimitError);
      expect((err as ForjaRateLimitError).retryAfter).toBeUndefined();
    }
  });

  it('handles non-Error rejection values from fetch', async () => {
    // fetch rejects with a string, not an Error — exercises the
    // `error instanceof Error ? error : undefined` branch.
    const fetch = vi.fn().mockRejectedValue('connection died');
    const http = createHttpClient({ ...config, fetch });

    try {
      await http.get('/anything');
    } catch (err) {
      expect(err).toBeInstanceOf(ForjaNetworkError);
      expect((err as ForjaNetworkError).cause).toBeUndefined();
    }
  });

  it('throws ForjaRateLimitError on 429 with retry-after', async () => {
    const fetch = mockFetch(429, { detail: 'Rate limited' }, {
      'retry-after': '60',
    });
    const http = createHttpClient({ ...config, fetch });

    try {
      await http.get('/blogs');
    } catch (err) {
      expect(err).toBeInstanceOf(ForjaRateLimitError);
      expect((err as ForjaRateLimitError).retryAfter).toBe(60);
    }
  });

  it('throws ForjaServerError on 500', async () => {
    const fetch = mockFetch(500, { detail: 'Internal error' });
    const http = createHttpClient({ ...config, fetch });

    await expect(http.get('/blogs')).rejects.toThrow(ForjaServerError);
  });

  it('throws ForjaNetworkError on fetch failure', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    const http = createHttpClient({ ...config, fetch });

    await expect(http.get('/blogs')).rejects.toThrow(ForjaNetworkError);
  });

  it('sends X-Site-Domain header when siteDomain is configured', async () => {
    const fetch = mockFetch(200, { id: '1' });
    const http = createHttpClient({ ...config, fetch, siteDomain: 'shop.example.com' });

    await http.get('/sites/by-domain');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/sites/by-domain',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Site-Domain': 'shop.example.com',
        }),
      }),
    );
  });

  it('getText returns the raw response body as text', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: () => Promise.resolve('plain text body'),
    });
    const http = createHttpClient({ ...config, fetch });

    const result = await http.getText('/exports/sitemap.xml');

    expect(result).toBe('plain text body');
  });

  it('delete returns void on success', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      headers: new Headers(),
    });
    const http = createHttpClient({ ...config, fetch });

    await http.delete('/blogs/1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/blogs/1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws ForjaServerError for unhandled non-5xx status codes', async () => {
    // 418 isn't specifically handled and isn't >= 500 — exercises the
    // default branch in the status switch.
    const fetch = mockFetch(418, { detail: "I'm a teapot" });
    const http = createHttpClient({ ...config, fetch });

    await expect(http.get('/anything')).rejects.toThrow(ForjaServerError);
  });

  it('uses response.statusText when JSON body has no detail', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      json: () => Promise.reject(new Error('not json')),
    });
    const http = createHttpClient({ ...config, fetch });

    try {
      await http.get('/blogs');
    } catch (err) {
      expect(err).toBeInstanceOf(ForjaServerError);
      expect((err as ForjaServerError).message).toBe(
        'Internal Server Error',
      );
    }
  });

  // The canonical 404 -> null / rethrow contract lives here once; resource
  // helpers anchor to this test rather than re-proving the mechanics each.
  describe('getOrNull', () => {
    it('returns the parsed body on success', async () => {
      const fetch = mockFetch(200, { id: '1' });
      const http = createHttpClient({ ...config, fetch });

      expect(await http.getOrNull('/blogs/1')).toEqual({ id: '1' });
    });

    it('returns null on 404 instead of throwing ForjaNotFoundError', async () => {
      const fetch = mockFetch(404, { detail: 'Not found' });
      const http = createHttpClient({ ...config, fetch });

      expect(await http.getOrNull('/blogs/999')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const fetch = mockFetch(401, { detail: 'Invalid API key' });
      const http = createHttpClient({ ...config, fetch });

      await expect(http.getOrNull('/blogs')).rejects.toThrow(ForjaAuthError);
    });

    it('forwards query params to the request', async () => {
      const fetch = mockFetch(200, { ok: true });
      const http = createHttpClient({ ...config, fetch });

      await http.getOrNull('/blogs', { page: '2' });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/blogs?page=2',
        expect.any(Object),
      );
    });
  });
});

describe('createPaginatedResult', () => {
  const meta = { page: 1, page_size: 2, total_pages: 3, total_items: 5 };
  const data = [{ id: 1 }, { id: 2 }];

  it('exposes data and meta', () => {
    const result = createPaginatedResult(data, meta, async () => ({
      data: [],
      meta,
    }));
    expect(result.data).toEqual(data);
    expect(result.meta).toEqual(meta);
  });

  it('fetchNext returns next page', async () => {
    const page2Data = [{ id: 3 }, { id: 4 }];
    const page2Meta = { page: 2, page_size: 2, total_pages: 3, total_items: 5 };
    const fetchPage = vi.fn().mockResolvedValue({
      data: page2Data,
      meta: page2Meta,
    });

    const result = createPaginatedResult(data, meta, fetchPage);
    const next = await result.fetchNext();

    expect(fetchPage).toHaveBeenCalledWith(2);
    expect(next?.data).toEqual(page2Data);
    expect(next?.meta.page).toBe(2);
  });

  it('fetchNext returns null on last page', async () => {
    const lastMeta = { page: 3, page_size: 2, total_pages: 3, total_items: 5 };
    const result = createPaginatedResult([{ id: 5 }], lastMeta, async () => ({
      data: [],
      meta: lastMeta,
    }));

    expect(await result.fetchNext()).toBeNull();
  });

  it('fetchAll collects all items across pages', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: 3 }, { id: 4 }],
        meta: { page: 2, page_size: 2, total_pages: 3, total_items: 5 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 5 }],
        meta: { page: 3, page_size: 2, total_pages: 3, total_items: 5 },
      });

    const result = createPaginatedResult(data, meta, fetchPage);
    const all = await result.fetchAll();

    expect(all).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('async iterator yields all pages', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({
        data: [{ id: 3 }],
        meta: { page: 2, page_size: 2, total_pages: 2, total_items: 3 },
      });

    const metaFirstPage = { page: 1, page_size: 2, total_pages: 2, total_items: 3 };
    const result = createPaginatedResult(data, metaFirstPage, fetchPage);

    const pages = [];
    for await (const page of result) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    expect(pages[0].meta.page).toBe(1);
    expect(pages[1].meta.page).toBe(2);
  });
});
