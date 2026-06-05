import { describe, expect, it, vi } from 'vitest';
import { RedirectsResource } from '../../resources/redirects.js';
import type { HttpClient } from '../../http.js';
import type {
  RedirectLookupResponse,
  RedirectResponse,
  RedirectStatusCode,
} from '../../types.js';
import { ForjaAuthError } from '../../errors.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(), getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('RedirectsResource', () => {
  describe('lookup', () => {
    it('returns redirect for a matching path', async () => {
      const http = createMockHttp();
      const redirect = { destination_path: '/new-path', status_code: 301 };
      vi.mocked(http.getOrNull).mockResolvedValue(redirect);

      const resource = new RedirectsResource(http, siteId);
      const result = await resource.lookup('/old-path');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/redirects/lookup`,
        { path: '/old-path' },
      );
      expect(result).toEqual(redirect);
    });

    it('returns null when no redirect exists', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const resource = new RedirectsResource(http, siteId);
      expect(await resource.lookup('/no-redirect')).toBeNull();
    });

    it('propagates non-404 errors from the underlying HTTP client', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));

      const resource = new RedirectsResource(http, siteId);
      await expect(resource.lookup('/anything')).rejects.toThrow(ForjaAuthError);
    });
  });

  // Issue #743 — pin the status_code domain at the type level so a future
  // refactor can't silently widen it back to `number`. These are static
  // type assertions; they pass by compiling (or fail by failing to).
  describe('status_code literal-union contract', () => {
    it('accepts the four allowed codes on the lookup response', () => {
      const ok301: RedirectLookupResponse = { destination_path: '/a', status_code: 301 };
      const ok302: RedirectLookupResponse = { destination_path: '/a', status_code: 302 };
      const ok307: RedirectLookupResponse = { destination_path: '/a', status_code: 307 };
      const ok308: RedirectLookupResponse = { destination_path: '/a', status_code: 308 };
      expect([ok301, ok302, ok307, ok308]).toHaveLength(4);
    });

    it('rejects non-allowed status codes at compile time', () => {
      // @ts-expect-error — 200 is outside the redirect status_code domain
      const _bad: RedirectLookupResponse = { destination_path: '/a', status_code: 200 };
      const _bad2: RedirectResponse = {
        id: 'r',
        site_id: 's',
        source_path: '/a',
        destination_path: '/b',
        // @ts-expect-error — 404 is outside the redirect status_code domain
        status_code: 404,
        is_active: true,
        description: null,
        created_at: '',
        updated_at: '',
      };
      // @ts-expect-error — bare `number` is no longer assignable
      const _bad3: RedirectStatusCode = 301 as number;
      expect(_bad).toBeTruthy();
      expect(_bad2).toBeTruthy();
      expect(_bad3).toBeTruthy();
    });
  });
});
