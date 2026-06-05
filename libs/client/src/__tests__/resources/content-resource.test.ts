import { describe, expect, it, vi } from 'vitest';
import { ContentResource } from '../../resources/content-resource.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return {
    get: vi.fn(),
    getOrNull: vi.fn(),
    getText: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };
}

const siteId = 'site-123';

interface ListItem {
  id: string;
}
interface Detail {
  id: string;
  title: string;
}

function makeResource(http: HttpClient) {
  return new ContentResource<ListItem, Detail>(http, siteId, {
    listPath: `/sites/${siteId}/things`,
    detailBase: 'things',
  });
}

describe('ContentResource', () => {
  describe('list (pagination scaffold)', () => {
    it('paginates and fetchNext walks to the next page', async () => {
      const http = createMockHttp();
      vi.mocked(http.get)
        .mockResolvedValueOnce({
          data: [{ id: '1' }],
          meta: { page: 1, page_size: 1, total_pages: 2, total_items: 2 },
        })
        .mockResolvedValueOnce({
          data: [{ id: '2' }],
          meta: { page: 2, page_size: 1, total_pages: 2, total_items: 2 },
        });

      const res = makeResource(http);
      const page1 = await res.list({ page: 1, pageSize: 1 });

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/things`, {
        page: '1',
        page_size: '1',
      });
      expect(page1.data).toEqual([{ id: '1' }]);

      const page2 = await page1.fetchNext();
      expect(page2?.data).toEqual([{ id: '2' }]);
      // Last page → no further page.
      expect(await page2?.fetchNext()).toBeNull();
    });

    it('defaults to page 1 when no params are given', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });
      const res = makeResource(http);
      await res.list();
      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/things`, { page: '1' });
    });
  });

  describe('getDetail / get (null vs rethrow per SDK pattern)', () => {
    it('returns null when the entity is missing (404 → null)', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);
      const res = makeResource(http);
      expect(await res.getDetail('missing')).toBeNull();
      expect(http.getOrNull).toHaveBeenCalledWith('/things/missing/detail', {
        locale: undefined,
      });
    });

    it('passes the locale resolver through to getDetail', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: '1', title: 'T' });
      const res = makeResource(http);
      expect(await res.getDetail('1', { locale: 'en' })).toEqual({ id: '1', title: 'T' });
      expect(http.getOrNull).toHaveBeenCalledWith('/things/1/detail', { locale: 'en' });
    });

    it('rethrows non-404 transport errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('nope'));
      const res = makeResource(http);
      await expect(res.getDetail('1')).rejects.toBeInstanceOf(ForjaAuthError);
    });
  });
});
